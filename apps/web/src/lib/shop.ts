import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { accessFor, type Access, type SubscriptionStatus } from "@petshop/core";
import {
  checkDatabaseRole,
  member,
  organization,
  session as sessionTable,
  shopProfiles,
  subscriptions,
  withTenant,
  type Transaction,
} from "@petshop/db";
import { auth } from "./auth";
import { db } from "./db";
import { isPlatformAdmin } from "./env";
import { can, primaryRole, type Capability, type Role } from "./permissions";
export { fail, ok, type ActionResult } from "./action-result";

export type ShopProfile = typeof shopProfiles.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

export interface ShopContext {
  user: { id: string; name: string; email: string; phone: string | null };
  sessionToken: string;
  isPlatformAdmin: boolean;
  organization: { id: string; name: string; slug: string; logo: string | null };
  role: string;
  primaryRole: Role;
  profile: ShopProfile;
  subscription: Subscription | null;
  access: Access;
}

/** Sessão do usuário (memorizada por requisição). */
export const getSession = cache(async () => {
  // Lê os cabeçalhos antes de criar a autenticação: assim o Next sabe que a página é dinâmica.
  const requestHeaders = await headers();
  return auth().api.getSession({ headers: requestHeaders });
});

export async function requireUser(next?: string) {
  const session = await getSession();
  if (!session) redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  return session;
}

type LoadResult = ShopContext | "no-session" | "no-shop";

let roleChecked: Promise<void> | null = null;

/** Recusa operar se a conexão do banco ignora o RLS (superusuário ou BYPASSRLS). Conferido uma vez por processo. */
function assertSafeDatabaseRole(): Promise<void> {
  roleChecked ??= checkDatabaseRole(db()).then((check) => {
    if (check.bypassesRls) {
      roleChecked = null;
      throw new Error(
        `O usuário do banco "${check.role}" ignora o RLS. Configure DATABASE_URL com o papel da aplicação (docs/infra.md).`,
      );
    }
  });
  return roleChecked;
}

/** Carrega o pet shop ativo da sessão, com papel, perfil e assinatura. */
export const loadShopContext = cache(async (): Promise<LoadResult> => {
  await assertSafeDatabaseRole();
  const session = await getSession();
  if (!session) return "no-session";
  const userId = session.user.id;

  let organizationId = session.session.activeOrganizationId ?? null;
  let membership = organizationId
    ? await db().query.member.findFirst({
        where: and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
      })
    : undefined;

  if (!membership) {
    // Sem pet shop ativo (ou removido da equipe): usa o primeiro de que a pessoa faz parte.
    membership = await db().query.member.findFirst({
      where: eq(member.userId, userId),
      orderBy: asc(member.createdAt),
    });
    if (!membership) return "no-shop";
    organizationId = membership.organizationId;
    await db()
      .update(sessionTable)
      .set({ activeOrganizationId: organizationId })
      .where(eq(sessionTable.token, session.session.token));
  }

  const org = await db().query.organization.findFirst({
    where: eq(organization.id, membership.organizationId),
  });
  if (!org) return "no-shop";

  const { profile, subscription } = await withTenant(db(), org.id, async (tx) => {
    let profile = await tx.query.shopProfiles.findFirst({
      where: eq(shopProfiles.organizationId, org.id),
    });
    if (!profile) {
      await tx.insert(shopProfiles).values({ organizationId: org.id }).onConflictDoNothing();
      profile = await tx.query.shopProfiles.findFirst({
        where: eq(shopProfiles.organizationId, org.id),
      });
    }
    const subscription =
      (await tx.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, org.id),
      })) ?? null;
    return { profile: profile!, subscription };
  });

  const access = accessFor(
    subscription
      ? {
          status: subscription.status as SubscriptionStatus,
          currentPeriodEnd: subscription.currentPeriodEnd,
          pastDueSince: subscription.pastDueSince,
          trialEnd: subscription.trialEnd,
        }
      : null,
  );

  const user = session.user as typeof session.user & { phone?: string | null };
  return {
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? null },
    sessionToken: session.session.token,
    isPlatformAdmin: isPlatformAdmin(user.email),
    organization: { id: org.id, name: org.name, slug: org.slug, logo: org.logo ?? null },
    role: membership.role,
    primaryRole: primaryRole(membership.role),
    profile,
    subscription,
    access,
  };
});

interface RequireShopOptions {
  capability?: Capability;
  /** Páginas que funcionam mesmo sem assinatura ativa (ex.: a própria tela de assinatura). */
  allowWithoutAccess?: boolean;
  next?: string;
}

/** Para páginas: garante sessão, pet shop, assinatura e permissão, redirecionando quando faltar algo. */
export async function requireShop(options: RequireShopOptions = {}): Promise<ShopContext> {
  const ctx = await loadShopContext();
  if (ctx === "no-session")
    redirect(options.next ? `/entrar?next=${encodeURIComponent(options.next)}` : "/entrar");
  if (ctx === "no-shop") redirect("/app/novo-pet-shop");
  if (!options.allowWithoutAccess && !ctx.access.canUseApp) redirect("/app/assinatura");
  if (options.capability && !can(ctx.role, options.capability))
    redirect("/app?aviso=sem-permissao");
  return ctx;
}

/**
 * Para Server Actions: mesmas checagens de `requireShop`, mas devolvendo um erro em vez de redirecionar.
 * Por padrão exige que a assinatura permita alterações.
 */
export async function shopForAction(
  capability?: Capability,
  { write = true }: { write?: boolean } = {},
): Promise<ShopContext | { error: string }> {
  const ctx = await loadShopContext();
  if (ctx === "no-session") return { error: "Sua sessão terminou. Entre de novo para continuar." };
  if (ctx === "no-shop") return { error: "Você ainda não faz parte de nenhum pet shop." };
  if (capability && !can(ctx.role, capability)) {
    return { error: "Seu papel na equipe não permite fazer isso. Fale com o dono do pet shop." };
  }
  if (write && !ctx.access.canWrite) {
    return {
      error:
        ctx.access.mode === "needs_subscription"
          ? "Ative a assinatura para salvar alterações."
          : "A assinatura está com pagamento pendente. Regularize para voltar a salvar alterações.",
    };
  }
  return ctx;
}

/** Executa no contexto do pet shop (RLS). */
export function inShop<T>(
  ctx: Pick<ShopContext, "organization">,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return withTenant(db(), ctx.organization.id, fn);
}
