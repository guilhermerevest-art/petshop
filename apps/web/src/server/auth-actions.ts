"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeBrPhone, slugify } from "@petshop/core";
import { organization, shopProfiles, withTenant } from "@petshop/db";
import { auth } from "@/lib/auth";
import { authErrorCode, authErrorMessage, cookieHeaderFrom } from "@/lib/auth-errors";
import { db } from "@/lib/db";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";

const email = z.string().trim().toLowerCase().email("Digite um e-mail válido.");
const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128);
const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeBrPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Digite o celular com DDD, por exemplo (19) 98765-4321.",
      });
      return z.NEVER;
    }
    return normalized;
  });

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

/** Encontra um endereço livre para o pet shop: nome-do-pet-shop, nome-do-pet-shop-2… */
async function availableSlug(name: string): Promise<string> {
  const base = slugify(name) || "pet-shop";
  for (let attempt = 1; attempt < 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 36)}-${attempt}`;
    const taken = await db().query.organization.findFirst({
      where: eq(organization.slug, candidate),
    });
    if (!taken && !["admin", "api", "app", "www"].includes(candidate)) return candidate;
  }
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`;
}

/** Cria o pet shop e o perfil inicial em nome do usuário da sessão informada. */
async function createShop(
  sessionHeaders: Headers,
  shopName: string,
  contact: { phone: string | null; email: string },
) {
  const slug = await availableSlug(shopName);
  const created = await auth().api.createOrganization({
    body: { name: shopName, slug },
    headers: sessionHeaders,
  });
  if (!created) throw new Error("Não foi possível criar o pet shop");
  await withTenant(db(), created.id, (tx) =>
    tx
      .insert(shopProfiles)
      .values({ organizationId: created.id, phone: contact.phone, email: contact.email })
      .onConflictDoNothing(),
  );
  return created;
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Digite seu nome."),
  email,
  phone,
  password,
  shopName: z.string().trim().min(2, "Digite o nome do pet shop.").max(80),
  terms: z.literal("on", { error: "Para continuar, aceite os termos de uso." }),
});

export async function signUpAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const data = parsed.data;

  try {
    const { headers: responseHeaders } = await auth().api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password, phone: data.phone },
      headers: await headers(),
      returnHeaders: true,
    });
    await createShop(cookieHeaderFrom(responseHeaders), data.shopName, {
      phone: data.phone,
      email: data.email,
    });
  } catch (error) {
    if (authErrorCode(error)?.startsWith("USER_ALREADY_EXISTS")) {
      return fail(authErrorMessage(error), { email: "Este e-mail já tem conta." });
    }
    console.error("signUpAction", error);
    return fail(authErrorMessage(error));
  }
  redirect("/app/assinatura");
}

const signInSchema = z.object({
  login: z.string().trim().min(1, "Digite seu e-mail ou usuário."),
  password: z.string().min(1, "Digite sua senha."),
});

/** Dono entra com e-mail; equipe entra com o usuário criado pelo dono ou gerente. */
export async function signInAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const { login, password } = parsed.data;
  try {
    if (login.includes("@")) {
      await auth().api.signInEmail({
        body: { email: login.toLowerCase(), password },
        headers: await headers(),
      });
    } else {
      await auth().api.signInUsername({
        body: { username: login.toLowerCase(), password },
        headers: await headers(),
      });
    }
  } catch (error) {
    return fail(authErrorMessage(error, "Não foi possível entrar. Tente de novo."));
  }
  redirect(safeNext(formData.get("next")));
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Digite a senha atual."),
  newPassword: password,
});

export async function changePasswordAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  try {
    await auth().api.changePassword({
      body: { ...parsed.data, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    const message = authErrorMessage(error, "Não foi possível trocar a senha.");
    return fail(
      message,
      message.includes("incorret") ? { currentPassword: "Senha atual incorreta." } : undefined,
    );
  }
  // A troca renova a sessão: recarrega a página já com a sessão nova.
  redirect("/app/conta?senha=alterada");
}

export async function signOutAction(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  redirect("/entrar");
}

export async function requestPasswordResetAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Confira o e-mail.", zodFieldErrors(parsed.error.issues));
  try {
    await auth().api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/redefinir-senha" },
    });
  } catch (error) {
    console.error("requestPasswordReset", error);
  }
  // Mesma resposta exista ou não a conta, para não revelar quem é cliente.
  return ok(
    "Se houver uma conta com este e-mail, você vai receber um link para criar uma nova senha.",
  );
}

export async function resetPasswordAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({ token: z.string().min(1), password })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Confira a senha.", zodFieldErrors(parsed.error.issues));
  try {
    await auth().api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
    });
  } catch (error) {
    return fail(authErrorMessage(error));
  }
  redirect("/entrar?senha=alterada");
}

const newShopSchema = z.object({
  shopName: z.string().trim().min(2, "Digite o nome do pet shop.").max(80),
});

/** Para quem já tem conta e quer abrir outro pet shop (ou entrou sem nenhum). */
export async function createShopAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = newShopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const requestHeaders = await headers();
  const session = await auth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/entrar");
  const user = session.user as typeof session.user & { phone?: string | null };
  try {
    await createShop(requestHeaders, parsed.data.shopName, {
      phone: user.phone ?? null,
      email: user.email,
    });
  } catch (error) {
    console.error("createShopAction", error);
    return fail(authErrorMessage(error));
  }
  redirect("/app/assinatura");
}

export async function switchShopAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  await auth().api.setActiveOrganization({ body: { organizationId }, headers: await headers() });
  redirect("/app");
}
