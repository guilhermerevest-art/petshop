"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { parseBRL } from "@petshop/core";
import { products, stockMovements } from "@petshop/db";
import { zodFieldErrors } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { fail, inShop, ok, shopForAction, type ActionResult } from "@/lib/shop";

const moneyField = (message: string, required: boolean) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) {
        if (required) ctx.addIssue({ code: "custom", message });
        return null;
      }
      const cents = parseBRL(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Valor inválido." });
        return z.NEVER;
      }
      return cents;
    });

const productSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(2, "Digite o nome do produto.").max(100),
  category: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  barcode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  price: moneyField("Digite o preço de venda.", true),
  cost: moneyField("", false),
  trackStock: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  minStock: z.coerce.number().int().min(0).max(100000).default(0),
  initialStock: z.coerce.number().int().min(0).max(100000).default(0),
});

export async function saveProductAction(
  _: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await shopForAction("products.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail("Confira os campos destacados.", zodFieldErrors(parsed.error.issues));
  const { id, price, cost, initialStock, ...data } = parsed.data;
  const orgId = ctx.organization.id;
  const result = await inShop(ctx, async (tx) => {
    if (data.barcode) {
      const clash = await tx.query.products.findFirst({
        where: and(
          eq(products.organizationId, orgId),
          eq(products.barcode, data.barcode),
          isNull(products.deletedAt),
          id ? ne(products.id, id) : undefined,
        ),
      });
      if (clash) return { error: `Este código já é do produto ${clash.name}.` };
    }
    const values = { ...data, priceCents: price!, costCents: cost };
    if (id) {
      const [updated] = await tx
        .update(products)
        .set(values)
        .where(and(eq(products.id, id), eq(products.organizationId, orgId)))
        .returning({ id: products.id });
      return updated ? { id: updated.id } : { error: "Produto não encontrado." };
    }
    const [created] = await tx
      .insert(products)
      .values({
        ...values,
        organizationId: orgId,
        stockQuantity: data.trackStock ? initialStock : 0,
      })
      .returning({ id: products.id });
    if (data.trackStock && initialStock > 0) {
      await tx.insert(stockMovements).values({
        organizationId: orgId,
        productId: created!.id,
        delta: initialStock,
        reason: "entrada",
        unitCostCents: cost,
        note: "Estoque inicial",
        createdBy: ctx.user.id,
      });
    }
    return { id: created!.id };
  });
  if ("error" in result) return fail(result.error!, { barcode: result.error! });
  revalidatePath("/app", "layout");
  return ok(id ? "Produto salvo" : "Produto cadastrado", { id: result.id });
}

const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["entrada", "perda", "contagem"]),
  quantity: z.coerce.number().int().min(0, "Quantidade inválida.").max(100000),
  unitCost: moneyField("", false),
  note: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
});

/** Entrada de mercadoria, perda ou contagem (ajusta para a quantidade contada). */
export async function stockMovementAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("products.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = movementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Confira os campos.", zodFieldErrors(parsed.error.issues));
  const { productId, type, quantity, unitCost, note } = parsed.data;
  if (type !== "contagem" && quantity === 0)
    return fail("Digite a quantidade.", { quantity: "Digite a quantidade." });
  const result = await inShop(ctx, async (tx) => {
    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, ctx.organization.id)))
      .for("update");
    if (!product) return null;
    const delta =
      type === "entrada"
        ? quantity
        : type === "perda"
          ? -quantity
          : quantity - product.stockQuantity;
    if (delta === 0) return { product, delta };
    await tx
      .update(products)
      .set({
        stockQuantity: product.stockQuantity + delta,
        trackStock: true,
        ...(type === "entrada" && unitCost !== null ? { costCents: unitCost } : {}),
      })
      .where(eq(products.id, productId));
    await tx.insert(stockMovements).values({
      organizationId: ctx.organization.id,
      productId,
      delta,
      reason: type === "contagem" ? "ajuste" : type,
      unitCostCents: type === "entrada" ? unitCost : null,
      note,
      createdBy: ctx.user.id,
    });
    if (type !== "entrada") {
      await audit(tx, ctx, "estoque.ajuste", {
        entity: "product",
        entityId: productId,
        data: { delta, type },
      });
    }
    return { product, delta };
  });
  if (!result) return fail("Produto não encontrado.");
  revalidatePath("/app", "layout");
  const now = result.product.stockQuantity + result.delta;
  if (result.delta === 0) return ok("A contagem bateu com o estoque.");
  return ok(`Estoque de ${result.product.name}: ${now} ${now === 1 ? "unidade" : "unidades"}`);
}

export async function archiveProductAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("products.manage");
  if ("error" in ctx) return fail(ctx.error);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Produto não encontrado.");
  await inShop(ctx, (tx) =>
    tx
      .update(products)
      .set({ deletedAt: new Date(), active: false })
      .where(and(eq(products.id, id.data), eq(products.organizationId, ctx.organization.id))),
  );
  revalidatePath("/app", "layout");
  redirect("/app/produtos");
}
