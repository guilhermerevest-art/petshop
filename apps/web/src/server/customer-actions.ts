"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeBrPhone, parseDocument } from "@petshop/core";
import { customers, pets } from "@petshop/db";
import { zodFieldErrors } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { findCustomerByPhone } from "@/lib/customers";
import { fieldsWithPrefix, petSchema } from "@/lib/pets";
import { fail, inShop, ok, shopForAction, type ActionResult } from "@/lib/shop";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const customerSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(2, "Digite o nome do tutor.").max(100),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const phone = normalizeBrPhone(value);
      if (!phone) {
        ctx.addIssue({
          code: "custom",
          message: "Digite o celular com DDD, por exemplo (19) 98765-4321.",
        });
        return z.NEVER;
      }
      return phone;
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Digite um e-mail válido."),
  document: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const parsed = parseDocument(value);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: "Este CPF não é válido. Confira os números." });
        return z.NEVER;
      }
      return parsed.value;
    }),
  origin: optionalText(60),
  notes: optionalText(1000),
  marketingOptIn: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export interface SavedCustomer {
  id: string;
  name: string;
  petId: string | null;
}

/**
 * Cria ou atualiza o tutor. No cadastro, aceita também o primeiro pet (campos "pet.*").
 * `redirectTo=ficha` leva para a ficha do tutor; senão devolve os ids (usado no agendamento).
 */
export async function saveCustomerAction(
  _: ActionResult<SavedCustomer> | null,
  formData: FormData,
): Promise<ActionResult<SavedCustomer>> {
  const ctx = await shopForAction("customers.manage");
  if ("error" in ctx) return fail(ctx.error);
  const raw = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("pet.")));
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const { id, ...data } = parsed.data;

  const duplicate = await findCustomerByPhone(ctx, data.phone, id);
  if (duplicate) {
    return fail(`Já existe um cliente com este celular: ${duplicate.name}.`, {
      phone: `Este celular já é de ${duplicate.name}.`,
    });
  }

  const petFields = fieldsWithPrefix(formData, "pet.");
  const withPet = !id && Boolean(petFields.name?.trim());
  let pet: z.infer<ReturnType<typeof petSchema>> | null = null;
  if (withPet) {
    const petParsed = petSchema(ctx.profile.sizeRanges).safeParse(petFields);
    if (!petParsed.success) {
      const errors = zodFieldErrors(petParsed.error.issues);
      return fail(
        "Confira os dados do pet.",
        Object.fromEntries(Object.entries(errors).map(([k, v]) => [`pet.${k}`, v])),
      );
    }
    pet = petParsed.data;
  }

  const saved = await inShop(ctx, async (tx) => {
    const values = {
      ...data,
      marketingOptInAt: data.marketingOptIn ? new Date() : null,
    };
    let customerId = id;
    if (customerId) {
      const existing = await tx.query.customers.findFirst({
        where: and(eq(customers.id, customerId), eq(customers.organizationId, ctx.organization.id)),
      });
      if (!existing) return null;
      await tx
        .update(customers)
        .set({
          ...values,
          // Mantém a data original do consentimento enquanto ele continuar valendo.
          marketingOptInAt: data.marketingOptIn ? (existing.marketingOptInAt ?? new Date()) : null,
        })
        .where(eq(customers.id, customerId));
    } else {
      const [created] = await tx
        .insert(customers)
        .values({ ...values, organizationId: ctx.organization.id })
        .returning({ id: customers.id });
      customerId = created!.id;
      await audit(tx, ctx, "cliente.criado", { entity: "customer", entityId: customerId });
    }
    let petId: string | null = null;
    if (pet) {
      const [createdPet] = await tx
        .insert(pets)
        .values({ ...pet, organizationId: ctx.organization.id, customerId })
        .returning({ id: pets.id });
      petId = createdPet!.id;
    }
    return { id: customerId, name: data.name, petId };
  });
  if (!saved) return fail("Cliente não encontrado.");

  revalidatePath("/app", "layout");
  if (formData.get("redirectTo") === "ficha") redirect(`/app/clientes/${saved.id}`);
  return ok(id ? "Cliente salvo" : "Cliente cadastrado", saved);
}

export async function archiveCustomerAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("customers.manage");
  if ("error" in ctx) return fail(ctx.error);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Cliente não encontrado.");
  await inShop(ctx, async (tx) => {
    await tx
      .update(customers)
      .set({ deletedAt: new Date() })
      .where(and(eq(customers.id, id.data), eq(customers.organizationId, ctx.organization.id)));
    await audit(tx, ctx, "cliente.removido", { entity: "customer", entityId: id.data });
  });
  revalidatePath("/app", "layout");
  redirect("/app/clientes");
}

export async function savePetAction(
  _: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await shopForAction("customers.manage");
  if ("error" in ctx) return fail(ctx.error);
  const id = String(formData.get("id") ?? "") || null;
  const customerId = String(formData.get("customerId") ?? "");
  const parsed = petSchema(ctx.profile.sizeRanges).safeParse(fieldsWithPrefix(formData, "pet."));
  if (!parsed.success) {
    const errors = zodFieldErrors(parsed.error.issues);
    return fail(
      "Confira os dados do pet.",
      Object.fromEntries(Object.entries(errors).map(([k, v]) => [`pet.${k}`, v])),
    );
  }
  const saved = await inShop(ctx, async (tx) => {
    const owner = await tx.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.organizationId, ctx.organization.id)),
    });
    if (!owner) return null;
    if (id) {
      const [updated] = await tx
        .update(pets)
        .set(parsed.data)
        .where(and(eq(pets.id, id), eq(pets.customerId, customerId)))
        .returning({ id: pets.id });
      return updated ?? null;
    }
    const [created] = await tx
      .insert(pets)
      .values({ ...parsed.data, organizationId: ctx.organization.id, customerId })
      .returning({ id: pets.id });
    return created ?? null;
  });
  if (!saved) return fail("Cliente não encontrado.");
  revalidatePath("/app", "layout");
  return ok(id ? `${parsed.data.name} atualizado` : `${parsed.data.name} cadastrado`, saved);
}

export async function archivePetAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("customers.manage");
  if ("error" in ctx) return fail(ctx.error);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Pet não encontrado.");
  await inShop(ctx, (tx) =>
    tx
      .update(pets)
      .set({ deletedAt: new Date() })
      .where(and(eq(pets.id, id.data), eq(pets.organizationId, ctx.organization.id))),
  );
  revalidatePath("/app", "layout");
  return ok("Pet removido da ficha");
}
