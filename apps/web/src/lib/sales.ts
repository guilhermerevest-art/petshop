import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, notInArray } from "drizzle-orm";
import { buildPixPayload, todayIn, zonedToUtc, addDays } from "@petshop/core";
import {
  appointmentPets,
  appointments,
  cashSessions,
  customers,
  member,
  orderItems,
  orders,
  payments,
  pets,
  pixSettings,
  products,
  user,
  withSystem,
  type PaymentMethod,
} from "@petshop/db";
import { cashSummary, openCashSession, paymentTotals, type SalesError } from "@petshop/db/sales";
import { db } from "./db";
import { inShop, type ShopContext } from "./shop";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
};

export const SALES_ERRORS: Record<SalesError, string> = {
  comanda_nao_encontrada: "Comanda não encontrada.",
  comanda_fechada: "Esta comanda já foi fechada. Atualize a página.",
  tem_pagamento: "Já há pagamento lançado. Desfaça o pagamento para alterar a comanda.",
  valor_invalido: "Confira o valor.",
  acima_do_restante: "O valor passa do que falta pagar.",
  caixa_fechado: "Abra o caixa para receber em dinheiro.",
  caixa_ja_aberto: "O caixa já está aberto.",
  pagamento_nao_encontrado: "Pagamento não encontrado. Atualize a página.",
  pagamento_confirmado: "Este pagamento já foi conferido.",
  produto_nao_encontrado: "Produto não encontrado.",
  atendimento_nao_encontrado: "Atendimento não encontrado.",
};

export async function getOrder(ctx: ShopContext, id: string) {
  const orgId = ctx.organization.id;
  return inShop(ctx, async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.organizationId, orgId)),
    });
    if (!order) return null;
    const [items, paymentRows, customer, appointment, totals, session] = await Promise.all([
      tx
        .select({ item: orderItems, performerName: user.name })
        .from(orderItems)
        .leftJoin(user, eq(user.id, orderItems.performedBy))
        .where(eq(orderItems.orderId, id))
        .orderBy(asc(orderItems.createdAt)),
      tx
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, id), notInArray(payments.status, ["cancelado"])))
        .orderBy(asc(payments.createdAt)),
      order.customerId
        ? tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) })
        : Promise.resolve(undefined),
      order.appointmentId
        ? tx.query.appointments.findFirst({ where: eq(appointments.id, order.appointmentId) })
        : Promise.resolve(undefined),
      paymentTotals(tx, id),
      openCashSession(tx, orgId),
    ]);
    return {
      order,
      items,
      payments: paymentRows,
      customer: customer ?? null,
      appointment: appointment ?? null,
      confirmedCents: totals.confirmed,
      pendingCents: totals.pending,
      remainingCents: Math.max(0, order.totalCents - totals.confirmed - totals.pending),
      cashOpen: Boolean(session),
    };
  });
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

/** BR Code do PIX estático do pet shop com o valor e o número da comanda. */
export async function pixPayloadFor(
  ctx: ShopContext,
  amountCents: number,
  orderNumber: number,
): Promise<string | null> {
  const pix = await inShop(ctx, (tx) =>
    tx.query.pixSettings.findFirst({ where: eq(pixSettings.organizationId, ctx.organization.id) }),
  );
  if (!pix) return null;
  return buildPixPayload({
    key: pix.key,
    merchantName: pix.merchantName,
    merchantCity: pix.merchantCity,
    amountCents,
    txid: `COMANDA${orderNumber}`,
  });
}

/** Comandas abertas, pagas hoje e atendimentos de hoje ainda sem comanda. */
export async function listOrders(ctx: ShopContext) {
  const orgId = ctx.organization.id;
  const tz = ctx.profile.timezone;
  const today = todayIn(tz);
  const dayStart = zonedToUtc(today, 0, tz);
  const dayEnd = zonedToUtc(addDays(today, 1), 0, tz);
  return inShop(ctx, async (tx) => {
    const open = await tx
      .select({ order: orders, customerName: customers.name })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.organizationId, orgId), eq(orders.status, "aberta")))
      .orderBy(asc(orders.createdAt));
    const paidToday = await tx
      .select({ order: orders, customerName: customers.name })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.organizationId, orgId),
          eq(orders.status, "paga"),
          gte(orders.paidAt, dayStart),
          lt(orders.paidAt, dayEnd),
        ),
      )
      .orderBy(desc(orders.paidAt));
    // Atendimentos de hoje com pet pronto ou entregue e nenhuma comanda ativa.
    const withOrder = tx
      .select({ id: orders.appointmentId })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, orgId),
          isNotNull(orders.appointmentId),
          notInArray(orders.status, ["cancelada"]),
        ),
      );
    const toCharge = await tx
      .selectDistinct({
        appointmentId: appointments.id,
        startsAt: appointments.startsAt,
        customerName: customers.name,
      })
      .from(appointments)
      .innerJoin(appointmentPets, eq(appointmentPets.appointmentId, appointments.id))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(
        and(
          eq(appointments.organizationId, orgId),
          isNull(appointments.canceledAt),
          gte(appointments.startsAt, dayStart),
          lt(appointments.startsAt, dayEnd),
          inArray(appointmentPets.status, ["pronto", "concluido"]),
          notInArray(appointments.id, withOrder),
        ),
      )
      .orderBy(asc(appointments.startsAt));
    const petNames = toCharge.length
      ? await tx
          .select({ appointmentId: appointmentPets.appointmentId, name: pets.name })
          .from(appointmentPets)
          .innerJoin(pets, eq(pets.id, appointmentPets.petId))
          .where(
            inArray(
              appointmentPets.appointmentId,
              toCharge.map((a) => a.appointmentId),
            ),
          )
      : [];
    return {
      open,
      paidToday,
      toCharge: toCharge.map((a) => ({
        ...a,
        pets: petNames.filter((p) => p.appointmentId === a.appointmentId).map((p) => p.name),
      })),
    };
  });
}

/** Comanda ativa (não cancelada) de um atendimento, se houver. */
export async function orderOfAppointment(ctx: ShopContext, appointmentId: string) {
  return inShop(ctx, (tx) =>
    tx.query.orders.findFirst({
      where: and(
        eq(orders.organizationId, ctx.organization.id),
        eq(orders.appointmentId, appointmentId),
        notInArray(orders.status, ["cancelada"]),
      ),
    }),
  );
}

export async function getCashState(ctx: ShopContext) {
  const orgId = ctx.organization.id;
  return inShop(ctx, async (tx) => {
    const session = await openCashSession(tx, orgId);
    const summary = session ? await cashSummary(tx, session) : null;
    const sessionPayments = session
      ? await tx
          .select({
            payment: payments,
            orderNumber: orders.number,
            orderId: orders.id,
            customerName: customers.name,
          })
          .from(payments)
          .innerJoin(orders, eq(orders.id, payments.orderId))
          .leftJoin(customers, eq(customers.id, orders.customerId))
          .where(
            and(eq(payments.cashSessionId, session.id), notInArray(payments.status, ["cancelado"])),
          )
          .orderBy(desc(payments.createdAt))
      : [];
    // PIX aguardando conferência, de qualquer caixa.
    const pendingPix = await tx
      .select({
        payment: payments,
        orderNumber: orders.number,
        orderId: orders.id,
        customerName: customers.name,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(payments.organizationId, orgId), eq(payments.status, "pendente")))
      .orderBy(asc(payments.createdAt));
    const history = await tx
      .select({ session: cashSessions, closedByName: user.name })
      .from(cashSessions)
      .leftJoin(user, eq(user.id, cashSessions.closedBy))
      .where(and(eq(cashSessions.organizationId, orgId), isNotNull(cashSessions.closedAt)))
      .orderBy(desc(cashSessions.closedAt))
      .limit(10);
    return { session, summary, sessionPayments, pendingPix, history };
  });
}

/** Produtos ativos para vender na comanda. */
export async function listSellableProducts(ctx: ShopContext) {
  return inShop(ctx, (tx) =>
    tx
      .select({
        id: products.id,
        name: products.name,
        priceCents: products.priceCents,
        stockQuantity: products.stockQuantity,
        trackStock: products.trackStock,
      })
      .from(products)
      .where(
        and(
          eq(products.organizationId, ctx.organization.id),
          eq(products.active, true),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(products.name)),
  );
}

/** Pessoas da equipe (para indicar quem fez o serviço). */
export async function listStaff(ctx: ShopContext) {
  return db()
    .select({ id: user.id, name: user.name, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, ctx.organization.id))
    .orderBy(asc(user.name));
}

/** Recibo público pelo código do link (sem login). */
export async function getReceipt(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return withSystem(db(), async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.receiptToken, token) });
    if (!order || order.status !== "paga") return null;
    const [items, paymentRows, customer, profile, org] = await Promise.all([
      tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.createdAt)),
      tx
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, "confirmado")))
        .orderBy(asc(payments.createdAt)),
      order.customerId
        ? tx.query.customers.findFirst({ where: eq(customers.id, order.customerId) })
        : Promise.resolve(undefined),
      tx.query.shopProfiles.findFirst({
        where: (t, { eq: equals }) => equals(t.organizationId, order.organizationId),
      }),
      tx.query.organization.findFirst({
        where: (t, { eq: equals }) => equals(t.id, order.organizationId),
      }),
    ]);
    return {
      order,
      items,
      payments: paymentRows,
      customer: customer ?? null,
      profile: profile!,
      shopName: org?.name ?? "",
    };
  });
}
