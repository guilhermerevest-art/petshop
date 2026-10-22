"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  isValidSizeRanges,
  normalizeBrPhone,
  normalizeMerchantCity,
  normalizeMerchantName,
  normalizePixKey,
  parseDocument,
  PIX_KEY_TYPES,
  SIZES,
  validateCapacityRules,
  type CapacityRule,
  type Weekday,
} from "@petshop/core";
import {
  capacityRules,
  organization,
  pixSettings,
  servicePrices,
  services,
  shopProfiles,
  SERVICE_CATEGORIES,
  type OnboardingStep,
} from "@petshop/db";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { completeStep, nextStep } from "@/lib/onboarding";
import { INVITABLE_ROLES, isRole, ROLE_LABELS } from "@/lib/permissions";
import { SUGGESTED_SERVICES } from "@/lib/suggested-services";
import { fail, inShop, ok, shopForAction, type ActionResult } from "@/lib/shop";
import { zodFieldErrors } from "@/lib/action-result";
import { sendShopMessage } from "@/lib/whatsapp";

/** No assistente, depois de salvar, segue para a próxima etapa. */
function afterSave(formData: FormData, step: OnboardingStep, message: string): ActionResult {
  revalidatePath("/app", "layout");
  if (formData.get("wizard") === "1") {
    const next = nextStep(step);
    redirect(next ? `/app/configurar/${next}` : "/app/configurar/pronto");
  }
  return ok(message);
}

// ---------------------------------------------------------------- Dados do pet shop

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Cuiaba",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const shopDataSchema = z.object({
  name: z.string().trim().min(2, "Digite o nome do pet shop.").max(80),
  legalName: optionalText(120),
  document: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const parsed = parseDocument(value);
      if (!parsed) {
        ctx.addIssue({
          code: "custom",
          message: "Este CPF ou CNPJ não é válido. Confira os números.",
        });
        return z.NEVER;
      }
      return parsed.value;
    }),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const phone = normalizeBrPhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Digite o telefone com DDD." });
        return z.NEVER;
      }
      return phone;
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Digite um e-mail válido.",
    ),
  addressZip: optionalText(9),
  addressStreet: optionalText(120),
  addressNumber: optionalText(20),
  addressComplement: optionalText(60),
  addressDistrict: optionalText(80),
  addressCity: z.string().trim().min(2, "Digite a cidade.").max(80),
  addressState: z.enum(UFS, { error: "Escolha o estado." }),
  timezone: z.enum(TIMEZONES),
});

export async function saveShopDataAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("shop.edit");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = shopDataSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const { name, ...profile } = parsed.data;

  await db().update(organization).set({ name }).where(eq(organization.id, ctx.organization.id));
  await inShop(ctx, async (tx) => {
    await tx
      .update(shopProfiles)
      .set({ ...profile, addressZip: profile.addressZip?.replace(/\D/g, "") ?? null })
      .where(eq(shopProfiles.organizationId, ctx.organization.id));
    await completeStep(tx, ctx.organization.id, "dados");
  });
  return afterSave(formData, "dados", "Dados salvos");
}

// ---------------------------------------------------------------- Horários e vagas

const ruleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  intervalMinutes: z.number().int(),
  slots: z.number().int(),
});

export async function saveCapacityAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("schedule.edit");
  if ("error" in ctx) return fail(ctx.error);
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("rules") ?? "[]"));
  } catch {
    return fail("Não foi possível ler os horários. Recarregue a página e tente de novo.");
  }
  const parsed = z.array(ruleSchema).safeParse(raw);
  if (!parsed.success) return fail("Algum horário está incompleto. Confira os campos.");
  const rules = parsed.data as CapacityRule[];
  if (rules.length === 0) return fail("Abra pelo menos um dia da semana.");
  const issues = validateCapacityRules(rules);
  if (issues.length > 0) {
    const first = issues[0]!;
    return fail(`${first.message} (faixa ${first.index + 1}).`, {
      [`rule.${first.index}`]: first.message,
    });
  }

  await inShop(ctx, async (tx) => {
    await tx.delete(capacityRules).where(eq(capacityRules.organizationId, ctx.organization.id));
    await tx.insert(capacityRules).values(
      rules.map((rule) => ({
        organizationId: ctx.organization.id,
        weekday: rule.weekday as Weekday,
        startTime: rule.start,
        endTime: rule.end,
        intervalMinutes: rule.intervalMinutes,
        slots: rule.slots,
      })),
    );
    await completeStep(tx, ctx.organization.id, "horarios");
    await audit(tx, ctx, "horarios.alterados", { data: { faixas: rules.length } });
  });
  return afterSave(formData, "horarios", "Horários salvos");
}

// ---------------------------------------------------------------- PIX

const pixSchema = z.object({
  keyType: z.enum(PIX_KEY_TYPES, { error: "Escolha o tipo de chave." }),
  key: z.string().trim().min(1, "Digite a chave PIX."),
  merchantName: z.string().trim().min(2, "Digite o nome que aparece para quem paga."),
  merchantCity: z.string().trim().min(2, "Digite a cidade."),
});

const PIX_KEY_ERRORS: Record<(typeof PIX_KEY_TYPES)[number], string> = {
  cpf: "Este CPF não é válido. Confira os números.",
  cnpj: "Este CNPJ não é válido. Confira os números e letras.",
  email: "Este e-mail não é válido.",
  phone: "Digite o celular com DDD, como está cadastrado no banco.",
  random: "A chave aleatória tem 32 letras e números separados por traços. Copie do app do banco.",
};

export async function savePixAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("pix.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = pixSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const key = normalizePixKey(parsed.data.keyType, parsed.data.key);
  if (!key) return fail("Confira a chave PIX.", { key: PIX_KEY_ERRORS[parsed.data.keyType] });
  const values = {
    keyType: parsed.data.keyType,
    key,
    merchantName: normalizeMerchantName(parsed.data.merchantName),
    merchantCity: normalizeMerchantCity(parsed.data.merchantCity),
  };
  await inShop(ctx, async (tx) => {
    await tx
      .insert(pixSettings)
      .values({ organizationId: ctx.organization.id, ...values })
      .onConflictDoUpdate({ target: pixSettings.organizationId, set: values });
    await completeStep(tx, ctx.organization.id, "pix");
    await audit(tx, ctx, "pix.alterado", { data: { tipo: values.keyType } });
  });
  revalidatePath("/app", "layout");
  return ok("Chave PIX salva. Faça o teste abaixo.");
}

// ---------------------------------------------------------------- Serviços

const priceRowSchema = z.object({
  size: z.enum(SIZES),
  priceCents: z.number().int().min(0).max(10_000_00),
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(12 * 60),
});

const serviceSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(2, "Digite o nome do serviço.").max(80),
  category: z.enum(SERVICE_CATEGORIES),
  description: optionalText(300),
  isAddon: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  showInPortal: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

export async function saveServiceAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("services.edit");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  let prices: z.infer<typeof priceRowSchema>[];
  try {
    prices = z
      .array(priceRowSchema)
      .length(4)
      .parse(JSON.parse(String(formData.get("prices") ?? "[]")));
  } catch {
    return fail("Preencha preço e duração para todos os portes.", {
      prices: "Preencha preço e duração de cada porte.",
    });
  }
  const { id, ...data } = parsed.data;

  await inShop(ctx, async (tx) => {
    let serviceId = id;
    if (serviceId) {
      await tx
        .update(services)
        .set(data)
        .where(and(eq(services.id, serviceId), eq(services.organizationId, ctx.organization.id)));
    } else {
      const [{ position } = { position: 0 }] = await tx
        .select({ position: sql<number>`coalesce(max(${services.position}), 0) + 1` })
        .from(services)
        .where(eq(services.organizationId, ctx.organization.id));
      const [created] = await tx
        .insert(services)
        .values({ ...data, organizationId: ctx.organization.id, position })
        .returning({ id: services.id });
      serviceId = created!.id;
    }
    for (const price of prices) {
      await tx
        .insert(servicePrices)
        .values({ organizationId: ctx.organization.id, serviceId: serviceId!, ...price })
        .onConflictDoUpdate({
          target: [servicePrices.serviceId, servicePrices.size],
          set: { priceCents: price.priceCents, durationMinutes: price.durationMinutes },
        });
    }
    await completeStep(tx, ctx.organization.id, "servicos");
    await audit(tx, ctx, id ? "servico.alterado" : "servico.criado", {
      entity: "service",
      entityId: serviceId,
      data: { nome: data.name, precos: prices },
    });
  });
  revalidatePath("/app", "layout");
  return ok(id ? "Serviço salvo" : "Serviço criado");
}

export async function addSuggestedServicesAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("services.edit");
  if ("error" in ctx) return fail(ctx.error);
  const selected = new Set(formData.getAll("suggested").map(String));
  const chosen = SUGGESTED_SERVICES.filter((service) => selected.has(service.key));
  if (chosen.length === 0) return fail("Marque pelo menos um serviço.");

  await inShop(ctx, async (tx) => {
    const existing = await tx
      .select({ name: services.name })
      .from(services)
      .where(and(eq(services.organizationId, ctx.organization.id), isNull(services.deletedAt)));
    const names = new Set(existing.map((s) => s.name.toLowerCase()));
    let position = existing.length;
    for (const suggestion of chosen) {
      if (names.has(suggestion.name.toLowerCase())) continue;
      const [created] = await tx
        .insert(services)
        .values({
          organizationId: ctx.organization.id,
          name: suggestion.name,
          category: suggestion.category,
          description: suggestion.description,
          isAddon: suggestion.isAddon,
          position: ++position,
        })
        .returning({ id: services.id });
      await tx.insert(servicePrices).values(
        suggestion.prices.map((price) => ({
          organizationId: ctx.organization.id,
          serviceId: created!.id,
          ...price,
        })),
      );
    }
    await completeStep(tx, ctx.organization.id, "servicos");
  });
  revalidatePath("/app", "layout");
  return ok(
    `${chosen.length} ${chosen.length === 1 ? "serviço adicionado" : "serviços adicionados"}. Ajuste os preços se precisar.`,
  );
}

export async function archiveServiceAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("services.edit");
  if ("error" in ctx) return fail(ctx.error);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Serviço não encontrado.");
  await inShop(ctx, async (tx) => {
    await tx
      .update(services)
      .set({ deletedAt: new Date(), active: false })
      .where(and(eq(services.id, id.data), eq(services.organizationId, ctx.organization.id)));
    await audit(tx, ctx, "servico.removido", { entity: "service", entityId: id.data });
  });
  revalidatePath("/app", "layout");
  return ok("Serviço removido");
}

export async function saveSizeRangesAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("services.edit");
  if ("error" in ctx) return fail(ctx.error);
  const ranges = {
    P: Number(String(formData.get("P")).replace(",", ".")),
    M: Number(String(formData.get("M")).replace(",", ".")),
    G: Number(String(formData.get("G")).replace(",", ".")),
  };
  if (!isValidSizeRanges(ranges))
    return fail("Os limites precisam crescer: pequeno < médio < grande.");
  await inShop(ctx, (tx) =>
    tx
      .update(shopProfiles)
      .set({ sizeRanges: ranges })
      .where(eq(shopProfiles.organizationId, ctx.organization.id)),
  );
  revalidatePath("/app", "layout");
  return ok("Faixas de peso salvas");
}

/** Etapas opcionais (WhatsApp, equipe): seguir sem concluir agora. */
export async function finishStepAction(formData: FormData): Promise<void> {
  const ctx = await shopForAction("shop.edit", { write: false });
  if ("error" in ctx) redirect("/app");
  const step = String(formData.get("step")) as OnboardingStep;
  if (formData.get("complete") === "1") {
    await inShop(ctx, (tx) => completeStep(tx, ctx.organization.id, step));
  }
  const next = nextStep(step);
  revalidatePath("/app", "layout");
  redirect(next ? `/app/configurar/${next}` : "/app/configurar/pronto");
}

// ---------------------------------------------------------------- Equipe

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido."),
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
});

export interface InviteResult {
  link: string;
  sentByWhatsApp: boolean;
}

export async function inviteMemberAction(
  _: ActionResult<InviteResult> | null,
  formData: FormData,
): Promise<ActionResult<InviteResult>> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));

  let invitationId: string;
  try {
    const invitation = await auth().api.createInvitation({
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: ctx.organization.id,
        resend: true,
      },
      headers: await headers(),
    });
    invitationId = invitation.id;
  } catch (error) {
    return fail(authErrorMessage(error));
  }

  const link = appUrl(`/convite/${invitationId}`);
  let sentByWhatsApp = false;
  if (parsed.data.phone) {
    const result = await sendShopMessage(
      ctx,
      parsed.data.phone,
      `Olá! ${ctx.user.name} convidou você para a equipe do ${ctx.organization.name} como ${ROLE_LABELS[parsed.data.role]}. Para aceitar, abra: ${link}`,
      "convite",
    );
    sentByWhatsApp = result.ok;
  }
  await inShop(ctx, async (tx) => {
    await completeStep(tx, ctx.organization.id, "equipe");
    await audit(tx, ctx, "equipe.convite", {
      entity: "invitation",
      entityId: invitationId,
      data: { email: parsed.data.email, papel: parsed.data.role },
    });
  });
  revalidatePath("/app", "layout");
  return ok(sentByWhatsApp ? "Convite enviado pelo WhatsApp" : "Convite criado", {
    link,
    sentByWhatsApp,
  });
}

export async function cancelInvitationAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  try {
    await auth().api.cancelInvitation({
      body: { invitationId: String(formData.get("invitationId")) },
      headers: await headers(),
    });
  } catch (error) {
    return fail(authErrorMessage(error));
  }
  revalidatePath("/app", "layout");
  return ok("Convite cancelado");
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
  return ok("Papel atualizado");
}

export async function removeMemberAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("team.manage");
  if ("error" in ctx) return fail(ctx.error);
  const memberId = String(formData.get("memberId"));
  try {
    await auth().api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: ctx.organization.id },
      headers: await headers(),
    });
  } catch (error) {
    return fail(authErrorMessage(error, "Não foi possível remover esta pessoa."));
  }
  await inShop(ctx, (tx) =>
    audit(tx, ctx, "equipe.remocao", { entity: "member", entityId: memberId }),
  );
  revalidatePath("/app", "layout");
  return ok("Pessoa removida da equipe");
}
