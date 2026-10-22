"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeBrPhone } from "@petshop/core";
import { account, member, session, user } from "@petshop/db";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { completeStep } from "@/lib/onboarding";
import { INVITABLE_ROLES, isRole, ROLE_LABELS, primaryRole } from "@/lib/permissions";
import { fail, inShop, ok, shopForAction, type ActionResult, type ShopContext } from "@/lib/shop";
import { zodFieldErrors } from "@/lib/action-result";
import { isStaffEmail, normalizeUsername, staffEmail, USERNAME_RE } from "@/lib/usernames";
import { sendShopMessage } from "@/lib/whatsapp";

export interface AccessResult {
  name: string;
  username: string;
  password: string;
  loginUrl: string;
  sentByWhatsApp: boolean;
}

const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(64, "Use no máximo 64 caracteres.");

const createSchema = z.object({
  name: z.string().trim().min(2, "Digite o nome da pessoa.").max(80),
  username: z
    .string()
    .transform(normalizeUsername)
    .refine(
      (value) => USERNAME_RE.test(value),
      "Use de 3 a 30 letras minúsculas, números, ponto ou sublinhado (ex.: bruno.bombanho).",
    ),
  password,
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const phone = normalizeBrPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Digite o celular com DDD ou deixe em branco." });
        return z.NEVER;
      }
      return phone;
    }),
  role: z.enum(INVITABLE_ROLES as ["manager", "reception", "groomer"], {
    error: "Escolha o papel.",
  }),
  sendWhatsApp: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

async function hashPassword(value: string): Promise<string> {
  const context = await auth().$context;
  return context.password.hash(value);
}

function accessMessage(ctx: ShopContext, name: string, username: string, pass: string) {
  return (
    `Olá, ${name.split(" ")[0]}! Seu acesso ao sistema do ${ctx.organization.name}:\n\n` +
    `Endereço: ${appUrl("/entrar")}\nUsuário: ${username}\nSenha: ${pass}\n\n` +
    `Depois de entrar, troque a senha em "Minha conta".`
  );
}

/** Dono ou gerente cria o acesso de uma pessoa da equipe: nome, usuário e senha. Sem e-mail. */
export async function createMemberAction(
  _: ActionResult<AccessResult> | null,
  formData: FormData,
): Promise<ActionResult<AccessResult>> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;

  const taken = await db().query.user.findFirst({ where: eq(user.username, data.username) });
  if (taken) {
    return fail("Este usuário já existe.", {
      username: "Este usuário já está em uso. Tente outro, por exemplo com o nome do pet shop.",
    });
  }

  const userId = randomUUID();
  const now = new Date();
  const hashed = await hashPassword(data.password);
  await db().transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: data.name,
      email: staffEmail(data.username),
      emailVerified: false,
      username: data.username,
      displayUsername: data.username,
      phone: data.phone,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(member).values({
      id: randomUUID(),
      organizationId: ctx.organization.id,
      userId,
      role: data.role,
      createdAt: now,
    });
  });

  let sentByWhatsApp = false;
  if (data.sendWhatsApp && data.phone) {
    const result = await sendShopMessage(
      ctx,
      data.phone,
      accessMessage(ctx, data.name, data.username, data.password),
      "acesso_equipe",
    );
    sentByWhatsApp = result.ok;
  }

  await inShop(ctx, async (tx) => {
    await completeStep(tx, ctx.organization.id, "equipe");
    await audit(tx, ctx, "equipe.acesso_criado", {
      entity: "user",
      entityId: userId,
      data: { usuario: data.username, papel: data.role },
    });
  });
  revalidatePath("/app", "layout");
  return ok(sentByWhatsApp ? "Acesso criado e enviado pelo WhatsApp" : "Acesso criado", {
    name: data.name,
    username: data.username,
    password: data.password,
    loginUrl: appUrl("/entrar"),
    sentByWhatsApp,
  });
}

/** Membro do pet shop atual que o dono ou gerente pode administrar (nunca o dono). */
async function manageableMember(ctx: ShopContext, memberId: string) {
  const [row] = await db()
    .select({
      memberId: member.id,
      role: member.role,
      userId: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      phone: user.phone,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organization.id)))
    .limit(1);
  if (!row || primaryRole(row.role) === "owner" || row.userId === ctx.user.id) return null;
  return row;
}

const resetSchema = z.object({ memberId: z.string().min(1), password });

/** Define uma nova senha para alguém da equipe e encerra as sessões abertas dessa pessoa. */
export async function resetMemberPasswordAction(
  _: ActionResult<AccessResult> | null,
  formData: FormData,
): Promise<ActionResult<AccessResult>> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Confira a senha.", zodFieldErrors(parsed.error.issues));
  }
  const target = await manageableMember(ctx, parsed.data.memberId);
  if (!target) return fail("Não é possível trocar a senha desta pessoa.");

  const hashed = await hashPassword(parsed.data.password);
  const now = new Date();
  await db().transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ password: hashed, updatedAt: now })
      .where(and(eq(account.userId, target.userId), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (updated.length === 0) {
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: target.userId,
        providerId: "credential",
        userId: target.userId,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      });
    }
    await tx.delete(session).where(eq(session.userId, target.userId));
  });

  let sentByWhatsApp = false;
  const login = target.username ?? target.email;
  if (formData.get("sendWhatsApp") === "on" && target.phone) {
    const result = await sendShopMessage(
      ctx,
      target.phone,
      accessMessage(ctx, target.name, login, parsed.data.password),
      "acesso_equipe",
    );
    sentByWhatsApp = result.ok;
  }
  await inShop(ctx, (tx) =>
    audit(tx, ctx, "equipe.senha_redefinida", { entity: "user", entityId: target.userId }),
  );
  return ok(sentByWhatsApp ? "Nova senha enviada pelo WhatsApp" : "Nova senha definida", {
    name: target.name,
    username: login,
    password: parsed.data.password,
    loginUrl: appUrl("/entrar"),
    sentByWhatsApp,
  });
}

export async function updateMemberRoleAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  const memberId = String(formData.get("memberId"));
  const role = String(formData.get("role"));
  if (!isRole(role) || role === "owner") return fail("Papel inválido.");
  try {
    await auth().api.updateMemberRole({
      body: { memberId, role, organizationId: ctx.organization.id },
      headers: await headers(),
    });
  } catch (error) {
    return fail(authErrorMessage(error, "Não foi possível mudar o papel."));
  }
  await inShop(ctx, (tx) =>
    audit(tx, ctx, "equipe.papel", { entity: "member", entityId: memberId, data: { papel: role } }),
  );
  revalidatePath("/app", "layout");
  return ok(`Papel alterado para ${ROLE_LABELS[role]}`);
}

/**
 * Tira a pessoa da equipe. Se o acesso foi criado só para este pet shop (usuário sem e-mail) e ela não
 * participa de nenhum outro, o acesso é apagado e o usuário fica livre para ser usado de novo.
 */
export async function removeMemberAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  const target = await manageableMember(ctx, String(formData.get("memberId")));
  if (!target) return fail("Não é possível remover esta pessoa.");

  await db().transaction(async (tx) => {
    await tx.delete(member).where(eq(member.id, target.memberId));
    const others = await tx
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, target.userId));
    if (others.length === 0 && isStaffEmail(target.email)) {
      await tx.delete(user).where(eq(user.id, target.userId));
    } else {
      await tx.delete(session).where(eq(session.userId, target.userId));
    }
  });
  await inShop(ctx, (tx) =>
    audit(tx, ctx, "equipe.remocao", {
      entity: "user",
      entityId: target.userId,
      data: { nome: target.name },
    }),
  );
  revalidatePath("/app", "layout");
  return ok(`${target.name.split(" ")[0]} saiu da equipe`);
}
