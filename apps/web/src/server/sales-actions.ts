"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { formatBRL, parseBRL, pixChargeMessages, receiptMessage, type Size } from "@petshop/core";
import {
  customers,
  orders,
  PAYMENT_METHODS,
  products,
  servicePrices,
  services,
  type Transaction,
} from "@petshop/db";
import {
  addPayment,
  cancelOrder,
  cancelPayment,
  closeCash,
  confirmPayment,
  createOrder,
  editOrder,
  openCash,
  orderForAppointment,
  settleIfPaid,
  type NewOrderItem,
} from "@petshop/db/sales";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { pixPayloadFor, SALES_ERRORS } from "@/lib/sales";
import { fail, inShop, ok, shopForAction, type ActionResult, type ShopContext } from "@/lib/shop";
import { sendShopMessage } from "@/lib/whatsapp";

const uuid = z.string().uuid();

/** Valor em reais digitado pela pessoa ("75", "75,50", "R$ 75,50") para centavos. */
function money(value: FormDataEntryValue | null): number | null {
  if (value === null || String(value).trim() === "") return null;
  return parseBRL(String(value));
}

function done(_orderId: string, message: string): ActionResult {
  revalidatePath("/app", "layout");
  return ok(message);
}

/** Abre (ou reabre) a comanda do atendimento e vai para ela. */
export async function openAppointmentOrderAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const appointmentId = uuid.safeParse(formData.get("appointmentId"));
  if (!appointmentId.success) return fail("Atendimento não encontrado.");
  const result = await inShop(ctx, (tx) =>
    orderForAppointment(tx, {
      organizationId: ctx.organization.id,
      appointmentId: appointmentId.data,
      createdBy: ctx.user.id,
    }),
  );
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  revalidatePath("/app", "layout");
  redirect(`/app/comandas/${result.order.id}`);
}

/** Venda de balcão, com ou sem cliente. */
export async function newOrderAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const customerId = uuid.safeParse(formData.get("customerId"));
  const order = await inShop(ctx, async (tx) => {
    let validCustomer: string | null = null;
    if (customerId.success) {
      const found = await tx.query.customers.findFirst({
        where: and(
          eq(customers.id, customerId.data),
          eq(customers.organizationId, ctx.organization.id),
          isNull(customers.deletedAt),
        ),
      });
      validCustomer = found?.id ?? null;
    }
    return createOrder(tx, {
      organizationId: ctx.organization.id,
      customerId: validCustomer,
      createdBy: ctx.user.id,
    });
  });
  revalidatePath("/app", "layout");
  redirect(`/app/comandas/${order.id}`);
}

const itemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("servico"),
    serviceId: uuid,
    size: z.enum(["P", "M", "G", "GG"]),
    performedBy: z.string().optional(),
  }),
  z.object({
    kind: z.literal("produto"),
    productId: uuid,
    quantity: z.coerce.number().int().min(1).max(999),
  }),
  z.object({
    kind: z.literal("avulso"),
    description: z.string().trim().min(2, "Descreva o item.").max(80),
    quantity: z.coerce.number().int().min(1).max(999),
  }),
]);

async function resolveItem(
  tx: Transaction,
  ctx: ShopContext,
  data: z.infer<typeof itemSchema>,
  price: number | null,
): Promise<NewOrderItem | string> {
  const orgId = ctx.organization.id;
  if (data.kind === "servico") {
    const [row] = await tx
      .select({ name: services.name, priceCents: servicePrices.priceCents })
      .from(services)
      .innerJoin(servicePrices, eq(servicePrices.serviceId, services.id))
      .where(
        and(
          eq(services.id, data.serviceId),
          eq(services.organizationId, orgId),
          eq(servicePrices.size, data.size as Size),
        ),
      );
    if (!row) return "Este serviço não tem preço para o porte escolhido.";
    return {
      kind: "servico",
      description: `${row.name} (${data.size})`,
      quantity: 1,
      unitPriceCents: row.priceCents,
      serviceId: data.serviceId,
      performedBy: data.performedBy || null,
    };
  }
  if (data.kind === "produto") {
    const product = await tx.query.products.findFirst({
      where: and(eq(products.id, data.productId), eq(products.organizationId, orgId)),
    });
    if (!product) return "Produto não encontrado.";
    return {
      kind: "produto",
      description: product.name,
      quantity: data.quantity,
      unitPriceCents: product.priceCents,
      productId: product.id,
    };
  }
  if (price === null || price <= 0) return "Digite o valor do item.";
  return {
    kind: "avulso",
    description: data.description,
    quantity: data.quantity,
    unitPriceCents: price,
  };
}

export async function addOrderItemAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!orderId.success || !parsed.success) {
    return fail(parsed.error?.issues[0]?.message ?? "Confira o item.");
  }
  const price = money(formData.get("price"));
  const result = await inShop(ctx, async (tx) => {
    const item = await resolveItem(tx, ctx, parsed.data, price);
    if (typeof item === "string") return { message: item, description: "" };
    const edited = await editOrder(tx, {
      organizationId: ctx.organization.id,
      orderId: orderId.data,
      addItem: item,
    });
    return edited.ok
      ? { message: null, description: item.description }
      : { message: SALES_ERRORS[edited.error], description: "" };
  });
  if (result.message) return fail(result.message);
  return done(orderId.data, `${result.description} incluído`);
}

export async function removeOrderItemAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  const itemId = uuid.safeParse(formData.get("itemId"));
  if (!orderId.success || !itemId.success) return fail("Item não encontrado.");
  const result = await inShop(ctx, (tx) =>
    editOrder(tx, {
      organizationId: ctx.organization.id,
      orderId: orderId.data,
      removeItemId: itemId.data,
    }),
  );
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  return done(orderId.data, "Item removido");
}

export async function setDiscountAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Comanda não encontrada.");
  const discount = money(formData.get("discount")) ?? 0;
  if (discount < 0) return fail("Confira o desconto.", { discount: "Valor inválido." });
  const result = await inShop(ctx, async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId.data), eq(orders.organizationId, ctx.organization.id)),
    });
    if (order && discount > order.subtotalCents)
      return { ok: false as const, error: "valor_invalido" as const };
    const edited = await editOrder(tx, {
      organizationId: ctx.organization.id,
      orderId: orderId.data,
      discountCents: discount,
    });
    if (edited.ok && discount > 0) {
      await audit(tx, ctx, "comanda.desconto", {
        entity: "order",
        entityId: orderId.data,
        data: { centavos: discount },
      });
    }
    return edited;
  });
  if (!result.ok) {
    return fail(
      result.error === "valor_invalido"
        ? "O desconto não pode passar do subtotal."
        : SALES_ERRORS[result.error],
      { discount: "Valor inválido." },
    );
  }
  return done(
    orderId.data,
    discount > 0 ? `Desconto de ${formatBRL(discount)} aplicado` : "Desconto removido",
  );
}

/** Depois de quitar: avisa o tutor com o link do recibo (se houver WhatsApp e celular). */
async function sendReceipt(ctx: ShopContext, orderId: string): Promise<boolean> {
  const data = await inShop(ctx, async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.organizationId, ctx.organization.id)),
    });
    if (!order?.customerId || order.status !== "paga") return null;
    const customer = await tx.query.customers.findFirst({
      where: eq(customers.id, order.customerId),
    });
    return customer ? { order, customer } : null;
  });
  if (!data) return false;
  const sent = await sendShopMessage(
    ctx,
    data.customer.phone,
    receiptMessage({
      shopName: ctx.organization.name,
      customerName: data.customer.name,
      number: data.order.number,
      totalCents: data.order.totalCents,
      url: appUrl(`/recibo/${data.order.receiptToken}`),
    }),
    "recibo",
  ).catch(() => ({ ok: false }));
  if (sent.ok) {
    await inShop(ctx, (tx) =>
      tx.update(orders).set({ receiptSentAt: new Date() }).where(eq(orders.id, orderId)),
    );
  }
  return sent.ok;
}

const paymentSchema = z.object({
  orderId: uuid,
  method: z.enum(PAYMENT_METHODS),
});

export async function addPaymentAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Escolha a forma de pagamento.");
  const amount = money(formData.get("amount"));
  if (amount === null || amount <= 0) return fail("Digite o valor.", { amount: "Digite o valor." });
  const received = money(formData.get("received"));
  if (parsed.data.method === "dinheiro" && received !== null && received < amount) {
    return fail("O valor recebido é menor que o valor pago.", { received: "Menor que o valor." });
  }
  const result = await inShop(ctx, (tx) =>
    addPayment(tx, {
      organizationId: ctx.organization.id,
      orderId: parsed.data.orderId,
      method: parsed.data.method,
      amountCents: amount,
      receivedCents: received,
      userId: ctx.user.id,
    }),
  );
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  const parts: string[] = [];
  if (parsed.data.method === "pix") parts.push("PIX lançado. Confira no app do banco e confirme.");
  else parts.push(`${formatBRL(amount)} recebido`);
  if (parsed.data.method === "dinheiro" && received !== null && received > amount) {
    parts.push(`Troco: ${formatBRL(received - amount)}`);
  }
  if (result.paid) {
    parts.push("Comanda paga");
    if (await sendReceipt(ctx, parsed.data.orderId)) parts.push("recibo enviado pelo WhatsApp");
  }
  return done(parsed.data.orderId, parts.join(". "));
}

export async function confirmPaymentAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const paymentId = uuid.safeParse(formData.get("paymentId"));
  if (!paymentId.success) return fail("Pagamento não encontrado.");
  const result = await inShop(ctx, async (tx) => {
    const confirmed = await confirmPayment(tx, {
      organizationId: ctx.organization.id,
      paymentId: paymentId.data,
      userId: ctx.user.id,
    });
    if (confirmed.ok) {
      await audit(tx, ctx, "pagamento.pix_conferido", {
        entity: "payment",
        entityId: paymentId.data,
        data: { centavos: confirmed.payment.amountCents },
      });
    }
    return confirmed;
  });
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  let message = `PIX de ${formatBRL(result.payment.amountCents)} confirmado`;
  if (result.paid) {
    message += ". Comanda paga";
    if (await sendReceipt(ctx, result.payment.orderId)) message += ". Recibo enviado pelo WhatsApp";
  }
  return done(result.payment.orderId, message);
}

export async function cancelPaymentAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const paymentId = uuid.safeParse(formData.get("paymentId"));
  if (!paymentId.success) return fail("Pagamento não encontrado.");
  const result = await inShop(ctx, async (tx) => {
    const canceled = await cancelPayment(tx, {
      organizationId: ctx.organization.id,
      paymentId: paymentId.data,
    });
    if (canceled.ok) {
      await audit(tx, ctx, "pagamento.desfeito", { entity: "payment", entityId: paymentId.data });
    }
    return canceled;
  });
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  revalidatePath("/app", "layout");
  return ok("Pagamento desfeito");
}

/** Comanda zerada (cortesia ou desconto total): fecha sem pagamento. */
export async function closeFreeOrderAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Comanda não encontrada.");
  const paid = await inShop(ctx, async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId.data), eq(orders.organizationId, ctx.organization.id)),
    });
    if (!order || order.status !== "aberta" || order.totalCents !== 0) return false;
    return settleIfPaid(tx, ctx.organization.id, order.id);
  });
  if (!paid) return fail("Só dá para fechar sem pagamento uma comanda com itens e total zero.");
  return done(orderId.data, "Comanda fechada");
}

export async function sendPixAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  const amount = money(formData.get("amount"));
  if (!orderId.success || !amount) return fail("Confira o valor.");
  const data = await inShop(ctx, async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, orderId.data), eq(orders.organizationId, ctx.organization.id)),
    });
    const customer = order?.customerId
      ? await tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) })
      : null;
    return order && customer ? { order, customer } : null;
  });
  if (!data) return fail("A comanda precisa de um cliente com celular para enviar o PIX.");
  const payload = await pixPayloadFor(ctx, amount, data.order.number);
  if (!payload) return fail("Cadastre a chave PIX em Configurações para cobrar por PIX.");
  const [intro, code] = pixChargeMessages({
    shopName: ctx.organization.name,
    customerName: data.customer.name,
    totalCents: amount,
    payload,
  });
  const first = await sendShopMessage(ctx, data.customer.phone, intro, "cobranca_pix");
  if (!first.ok) return fail(first.error ?? "Não foi possível enviar.");
  await sendShopMessage(ctx, data.customer.phone, code, "cobranca_pix");
  return ok("PIX enviado pelo WhatsApp");
}

export async function resendReceiptAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Comanda não encontrada.");
  const sent = await sendReceipt(ctx, orderId.data);
  if (!sent)
    return fail("Não foi possível enviar. Confira o WhatsApp do pet shop e o celular do cliente.");
  return done(orderId.data, "Recibo enviado pelo WhatsApp");
}

export async function cancelOrderAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const orderId = uuid.safeParse(formData.get("orderId"));
  if (!orderId.success) return fail("Comanda não encontrada.");
  const reason =
    String(formData.get("reason") ?? "")
      .trim()
      .slice(0, 200) || null;
  const result = await inShop(ctx, async (tx) => {
    const canceled = await cancelOrder(tx, {
      organizationId: ctx.organization.id,
      orderId: orderId.data,
      reason,
    });
    if (canceled.ok) {
      await audit(tx, ctx, "comanda.cancelada", {
        entity: "order",
        entityId: orderId.data,
        data: { reason },
      });
    }
    return canceled;
  });
  if (!result.ok) {
    return fail(
      result.error === "tem_pagamento"
        ? "Há pagamento confirmado. Desfaça o pagamento antes de cancelar a comanda."
        : SALES_ERRORS[result.error],
    );
  }
  revalidatePath("/app", "layout");
  redirect("/app/comandas?cancelada=1");
}

export async function openCashAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const opening = money(formData.get("opening")) ?? 0;
  const result = await inShop(ctx, async (tx) => {
    const opened = await openCash(tx, {
      organizationId: ctx.organization.id,
      openingCents: opening,
      userId: ctx.user.id,
    });
    if (opened.ok) await audit(tx, ctx, "caixa.aberto", { data: { troco: opening } });
    return opened;
  });
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  revalidatePath("/app", "layout");
  return ok("Caixa aberto");
}

export async function closeCashAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("sales.manage");
  if ("error" in ctx) return fail(ctx.error);
  const counted = money(formData.get("counted"));
  if (counted === null)
    return fail("Conte o dinheiro da gaveta e digite o valor.", {
      counted: "Digite o valor contado.",
    });
  const notes =
    String(formData.get("notes") ?? "")
      .trim()
      .slice(0, 300) || null;
  const result = await inShop(ctx, async (tx) => {
    const closed = await closeCash(tx, {
      organizationId: ctx.organization.id,
      countedCents: counted,
      userId: ctx.user.id,
      notes,
    });
    if (closed.ok) {
      await audit(tx, ctx, "caixa.fechado", {
        data: { esperado: closed.summary.expectedCashCents, contado: counted },
      });
    }
    return closed;
  });
  if (!result.ok) return fail(SALES_ERRORS[result.error]);
  const diff = counted - result.summary.expectedCashCents;
  revalidatePath("/app", "layout");
  return ok(
    diff === 0
      ? "Caixa fechado. O dinheiro bateu."
      : `Caixa fechado com ${diff > 0 ? "sobra" : "falta"} de ${formatBRL(Math.abs(diff))}.`,
  );
}
