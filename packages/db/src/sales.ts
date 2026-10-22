import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  appointmentPets,
  appointments,
  appointmentServices,
  cashSessions,
  memberCommissions,
  orderItems,
  orders,
  payments,
  pets,
  products,
  stockMovements,
  type OrderItemKind,
  type PaymentMethod,
} from "./schema";
import { FREE_STATUSES } from "./scheduling";
import type { Transaction } from "./tenancy";

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type CashSession = typeof cashSessions.$inferSelect;

export type SalesError =
  | "comanda_nao_encontrada"
  | "comanda_fechada"
  | "tem_pagamento"
  | "valor_invalido"
  | "acima_do_restante"
  | "caixa_fechado"
  | "caixa_ja_aberto"
  | "pagamento_nao_encontrado"
  | "pagamento_confirmado"
  | "produto_nao_encontrado"
  | "atendimento_nao_encontrado";

export type SalesResult<T = object> = ({ ok: true } & T) | { ok: false; error: SalesError };

const fail = (error: SalesError) => ({ ok: false as const, error });

export function newReceiptToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Próximo número de comanda do pet shop (trava até o fim da transação). */
async function nextOrderNumber(tx: Transaction, organizationId: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`orders:${organizationId}`}))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${orders.number}), 0)::int` })
    .from(orders)
    .where(eq(orders.organizationId, organizationId));
  return (row?.max ?? 0) + 1;
}

export interface NewOrderItem {
  kind: OrderItemKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
  serviceId?: string | null;
  productId?: string | null;
  appointmentServiceId?: string | null;
  performedBy?: string | null;
}

export async function createOrder(
  tx: Transaction,
  input: {
    organizationId: string;
    customerId?: string | null;
    appointmentId?: string | null;
    createdBy: string | null;
    items?: NewOrderItem[];
  },
): Promise<Order> {
  const number = await nextOrderNumber(tx, input.organizationId);
  const [order] = await tx
    .insert(orders)
    .values({
      organizationId: input.organizationId,
      number,
      customerId: input.customerId ?? null,
      appointmentId: input.appointmentId ?? null,
      receiptToken: newReceiptToken(),
      createdBy: input.createdBy,
    })
    .returning();
  if (input.items?.length) {
    await tx.insert(orderItems).values(
      input.items.map((item) => ({
        ...item,
        organizationId: input.organizationId,
        orderId: order!.id,
        totalCents: item.quantity * item.unitPriceCents,
      })),
    );
  }
  return recalcOrder(tx, order!.id);
}

/**
 * Comanda do atendimento: devolve a que já existe ou cria uma com os serviços feitos
 * (pets cancelados ou que não vieram ficam de fora).
 */
export async function orderForAppointment(
  tx: Transaction,
  input: { organizationId: string; appointmentId: string; createdBy: string | null },
): Promise<SalesResult<{ order: Order; created: boolean }>> {
  const existing = await tx.query.orders.findFirst({
    where: and(
      eq(orders.appointmentId, input.appointmentId),
      eq(orders.organizationId, input.organizationId),
      notInArray(orders.status, ["cancelada"]),
    ),
  });
  if (existing) return { ok: true, order: existing, created: false };
  const appointment = await tx.query.appointments.findFirst({
    where: and(
      eq(appointments.id, input.appointmentId),
      eq(appointments.organizationId, input.organizationId),
    ),
  });
  if (!appointment) return fail("atendimento_nao_encontrado");
  // Evita duas comandas para o mesmo atendimento quando duas pessoas clicam juntas.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`order-appt:${appointment.id}`}))`);
  const again = await tx.query.orders.findFirst({
    where: and(eq(orders.appointmentId, appointment.id), notInArray(orders.status, ["cancelada"])),
  });
  if (again) return { ok: true, order: again, created: false };

  const rows = await tx
    .select({ service: appointmentServices, petName: pets.name })
    .from(appointmentServices)
    .innerJoin(appointmentPets, eq(appointmentPets.id, appointmentServices.appointmentPetId))
    .innerJoin(pets, eq(pets.id, appointmentPets.petId))
    .where(
      and(
        eq(appointmentPets.appointmentId, appointment.id),
        notInArray(appointmentPets.status, [...FREE_STATUSES]),
      ),
    )
    .orderBy(
      asc(appointmentPets.createdAt),
      asc(appointmentServices.isAddon),
      asc(appointmentServices.createdAt),
    );
  const multiplePets = new Set(rows.map((r) => r.petName)).size > 1;
  const order = await createOrder(tx, {
    organizationId: input.organizationId,
    customerId: appointment.customerId,
    appointmentId: appointment.id,
    createdBy: input.createdBy,
    items: rows.map(({ service, petName }) => ({
      kind: "servico" as const,
      description: multiplePets ? `${service.name} (${petName})` : service.name,
      quantity: 1,
      unitPriceCents: service.priceCents,
      serviceId: service.serviceId,
      appointmentServiceId: service.id,
      performedBy: service.performedBy,
    })),
  });
  return { ok: true, order, created: true };
}

/** Recalcula subtotal e total da comanda a partir dos itens e do desconto. */
export async function recalcOrder(tx: Transaction, orderId: string): Promise<Order> {
  const [sum] = await tx
    .select({ value: sql<number>`coalesce(sum(${orderItems.totalCents}), 0)::int` })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const subtotal = sum?.value ?? 0;
  const [order] = await tx
    .update(orders)
    .set({
      subtotalCents: subtotal,
      totalCents: sql`greatest(0, ${subtotal} - ${orders.discountCents})`,
    })
    .where(eq(orders.id, orderId))
    .returning();
  return order!;
}

/** Comanda aberta e travada para alteração (linha bloqueada até o fim da transação). */
async function lockOpenOrder(
  tx: Transaction,
  organizationId: string,
  orderId: string,
): Promise<SalesResult<{ order: Order }>> {
  const [order] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
    .for("update");
  if (!order) return fail("comanda_nao_encontrada");
  if (order.status !== "aberta") return fail("comanda_fechada");
  return { ok: true, order };
}

async function hasActivePayments(tx: Transaction, orderId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), notInArray(payments.status, ["cancelado"])))
    .limit(1);
  return rows.length > 0;
}

/** Itens e desconto só mudam enquanto não há pagamento lançado. */
export async function editOrder(
  tx: Transaction,
  input: {
    organizationId: string;
    orderId: string;
    addItem?: NewOrderItem;
    removeItemId?: string;
    discountCents?: number;
  },
): Promise<SalesResult<{ order: Order }>> {
  const locked = await lockOpenOrder(tx, input.organizationId, input.orderId);
  if (!locked.ok) return locked;
  if (await hasActivePayments(tx, input.orderId)) return fail("tem_pagamento");
  if (input.addItem) {
    const item = input.addItem;
    if (item.quantity < 1 || item.unitPriceCents < 0) return fail("valor_invalido");
    await tx.insert(orderItems).values({
      ...item,
      organizationId: input.organizationId,
      orderId: input.orderId,
      totalCents: item.quantity * item.unitPriceCents,
    });
  }
  if (input.removeItemId) {
    await tx
      .delete(orderItems)
      .where(and(eq(orderItems.id, input.removeItemId), eq(orderItems.orderId, input.orderId)));
  }
  if (input.discountCents !== undefined) {
    if (input.discountCents < 0) return fail("valor_invalido");
    await tx
      .update(orders)
      .set({ discountCents: input.discountCents })
      .where(eq(orders.id, input.orderId));
  }
  return { ok: true, order: await recalcOrder(tx, input.orderId) };
}

export async function openCashSession(
  tx: Transaction,
  organizationId: string,
): Promise<CashSession | null> {
  const session = await tx.query.cashSessions.findFirst({
    where: and(eq(cashSessions.organizationId, organizationId), isNull(cashSessions.closedAt)),
  });
  return session ?? null;
}

export async function openCash(
  tx: Transaction,
  input: { organizationId: string; openingCents: number; userId: string },
): Promise<SalesResult<{ session: CashSession }>> {
  if (input.openingCents < 0) return fail("valor_invalido");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`cash:${input.organizationId}`}))`);
  if (await openCashSession(tx, input.organizationId)) return fail("caixa_ja_aberto");
  const [session] = await tx
    .insert(cashSessions)
    .values({
      organizationId: input.organizationId,
      openingCents: input.openingCents,
      openedBy: input.userId,
    })
    .returning();
  return { ok: true, session: session! };
}

export interface CashSummary {
  byMethod: Record<PaymentMethod, number>;
  confirmedCents: number;
  pendingPixCents: number;
  expectedCashCents: number;
  count: number;
}

export async function cashSummary(tx: Transaction, session: CashSession): Promise<CashSummary> {
  const rows = await tx
    .select({ method: payments.method, status: payments.status, amountCents: payments.amountCents })
    .from(payments)
    .where(eq(payments.cashSessionId, session.id));
  const byMethod: Record<PaymentMethod, number> = { pix: 0, dinheiro: 0, debito: 0, credito: 0 };
  let pendingPixCents = 0;
  let count = 0;
  for (const row of rows) {
    if (row.status === "confirmado") {
      byMethod[row.method] += row.amountCents;
      count++;
    } else if (row.status === "pendente") pendingPixCents += row.amountCents;
  }
  const confirmedCents = Object.values(byMethod).reduce((a, b) => a + b, 0);
  return {
    byMethod,
    confirmedCents,
    pendingPixCents,
    expectedCashCents: session.openingCents + byMethod.dinheiro,
    count,
  };
}

export async function closeCash(
  tx: Transaction,
  input: { organizationId: string; countedCents: number; userId: string; notes?: string | null },
): Promise<SalesResult<{ session: CashSession; summary: CashSummary }>> {
  if (input.countedCents < 0) return fail("valor_invalido");
  const session = await openCashSession(tx, input.organizationId);
  if (!session) return fail("caixa_fechado");
  const summary = await cashSummary(tx, session);
  const [closed] = await tx
    .update(cashSessions)
    .set({
      closedAt: new Date(),
      closedBy: input.userId,
      expectedCents: summary.expectedCashCents,
      countedCents: input.countedCents,
      notes: input.notes ?? null,
    })
    .where(eq(cashSessions.id, session.id))
    .returning();
  return { ok: true, session: closed!, summary };
}

/** Quanto falta pagar considerando pagamentos confirmados e PIX ainda em conferência. */
export async function paymentTotals(tx: Transaction, orderId: string) {
  const rows = await tx
    .select({ status: payments.status, amountCents: payments.amountCents })
    .from(payments)
    .where(eq(payments.orderId, orderId));
  const confirmed = rows
    .filter((r) => r.status === "confirmado")
    .reduce((s, r) => s + r.amountCents, 0);
  const pending = rows
    .filter((r) => r.status === "pendente")
    .reduce((s, r) => s + r.amountCents, 0);
  return { confirmed, pending };
}

/**
 * Lança um pagamento. PIX fica pendente até alguém conferir no banco; dinheiro e cartão já entram
 * confirmados. Dinheiro exige caixa aberto. Devolve se a comanda ficou paga.
 */
export async function addPayment(
  tx: Transaction,
  input: {
    organizationId: string;
    orderId: string;
    method: PaymentMethod;
    amountCents: number;
    receivedCents?: number | null;
    userId: string;
  },
): Promise<SalesResult<{ payment: Payment; paid: boolean }>> {
  const locked = await lockOpenOrder(tx, input.organizationId, input.orderId);
  if (!locked.ok) return locked;
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail("valor_invalido");
  const { confirmed, pending } = await paymentTotals(tx, input.orderId);
  if (input.amountCents > locked.order.totalCents - confirmed - pending) {
    return fail("acima_do_restante");
  }
  const session = await openCashSession(tx, input.organizationId);
  if (input.method === "dinheiro") {
    if (!session) return fail("caixa_fechado");
    if (input.receivedCents != null && input.receivedCents < input.amountCents) {
      return fail("valor_invalido");
    }
  }
  const isPix = input.method === "pix";
  const [payment] = await tx
    .insert(payments)
    .values({
      organizationId: input.organizationId,
      orderId: input.orderId,
      cashSessionId: session?.id ?? null,
      method: input.method,
      amountCents: input.amountCents,
      receivedCents:
        input.method === "dinheiro" ? (input.receivedCents ?? input.amountCents) : null,
      status: isPix ? "pendente" : "confirmado",
      confirmedAt: isPix ? null : new Date(),
      confirmedBy: isPix ? null : input.userId,
      createdBy: input.userId,
    })
    .returning();
  const paid = isPix ? false : await settleIfPaid(tx, input.organizationId, input.orderId);
  return { ok: true, payment: payment!, paid };
}

/** Confirma um PIX depois de conferido no extrato do banco. */
export async function confirmPayment(
  tx: Transaction,
  input: { organizationId: string; paymentId: string; userId: string },
): Promise<SalesResult<{ payment: Payment; paid: boolean }>> {
  const payment = await tx.query.payments.findFirst({
    where: and(eq(payments.id, input.paymentId), eq(payments.organizationId, input.organizationId)),
  });
  if (!payment) return fail("pagamento_nao_encontrado");
  const locked = await lockOpenOrder(tx, input.organizationId, payment.orderId);
  if (!locked.ok) return locked;
  if (payment.status !== "pendente") return fail("pagamento_confirmado");
  // O PIX entra no caixa aberto na hora da conferência (se houver).
  const session = await openCashSession(tx, input.organizationId);
  const [updated] = await tx
    .update(payments)
    .set({
      status: "confirmado",
      confirmedAt: new Date(),
      confirmedBy: input.userId,
      cashSessionId: session?.id ?? payment.cashSessionId,
    })
    .where(eq(payments.id, payment.id))
    .returning();
  const paid = await settleIfPaid(tx, input.organizationId, payment.orderId);
  return { ok: true, payment: updated!, paid };
}

/** Desfaz um pagamento lançado por engano (só enquanto a comanda está aberta). */
export async function cancelPayment(
  tx: Transaction,
  input: { organizationId: string; paymentId: string },
): Promise<SalesResult> {
  const payment = await tx.query.payments.findFirst({
    where: and(eq(payments.id, input.paymentId), eq(payments.organizationId, input.organizationId)),
  });
  if (!payment || payment.status === "cancelado") return fail("pagamento_nao_encontrado");
  const locked = await lockOpenOrder(tx, input.organizationId, payment.orderId);
  if (!locked.ok) return locked;
  await tx.update(payments).set({ status: "cancelado" }).where(eq(payments.id, payment.id));
  return { ok: true };
}

/**
 * Fecha a comanda quando os pagamentos confirmados cobrem o total: grava a comissão de cada
 * serviço e dá baixa no estoque dos produtos.
 */
export async function settleIfPaid(
  tx: Transaction,
  organizationId: string,
  orderId: string,
): Promise<boolean> {
  const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.status !== "aberta") return false;
  const { confirmed } = await paymentTotals(tx, orderId);
  if (confirmed < order.totalCents) return false;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  if (items.length === 0) return false;

  // Comissão: percentual da pessoa sobre o valor do serviço, proporcional ao desconto da comanda.
  const performers = [...new Set(items.map((i) => i.performedBy).filter((v): v is string => !!v))];
  const rates = performers.length
    ? await tx
        .select({ userId: memberCommissions.userId, percent: memberCommissions.percent })
        .from(memberCommissions)
        .where(
          and(
            eq(memberCommissions.organizationId, organizationId),
            inArray(memberCommissions.userId, performers),
          ),
        )
    : [];
  const factor = order.subtotalCents > 0 ? order.totalCents / order.subtotalCents : 0;
  for (const item of items) {
    if (item.kind !== "servico" || !item.performedBy) continue;
    const rate = rates.find((r) => r.userId === item.performedBy)?.percent ?? 0;
    if (rate <= 0) continue;
    await tx
      .update(orderItems)
      .set({ commissionCents: Math.round((item.totalCents * factor * rate) / 100) })
      .where(eq(orderItems.id, item.id));
  }

  for (const item of items) {
    if (item.kind !== "produto" || !item.productId) continue;
    const [product] = await tx
      .update(products)
      .set({ stockQuantity: sql`${products.stockQuantity} - ${item.quantity}` })
      .where(and(eq(products.id, item.productId), eq(products.trackStock, true)))
      .returning({ id: products.id });
    if (product) {
      await tx.insert(stockMovements).values({
        organizationId,
        productId: item.productId,
        delta: -item.quantity,
        reason: "venda",
        orderId,
      });
    }
  }

  await tx.update(orders).set({ status: "paga", paidAt: new Date() }).where(eq(orders.id, orderId));
  return true;
}

/** Cancela a comanda aberta (pagamentos pendentes são descartados; confirmados impedem). */
export async function cancelOrder(
  tx: Transaction,
  input: { organizationId: string; orderId: string; reason: string | null },
): Promise<SalesResult> {
  const locked = await lockOpenOrder(tx, input.organizationId, input.orderId);
  if (!locked.ok) return locked;
  const { confirmed } = await paymentTotals(tx, input.orderId);
  if (confirmed > 0) return fail("tem_pagamento");
  await tx
    .update(payments)
    .set({ status: "cancelado" })
    .where(and(eq(payments.orderId, input.orderId), eq(payments.status, "pendente")));
  await tx
    .update(orders)
    .set({ status: "cancelada", canceledAt: new Date(), cancelReason: input.reason })
    .where(eq(orders.id, input.orderId));
  return { ok: true };
}
