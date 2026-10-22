import "server-only";
import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { memberCommissions, orderItems, orders } from "@petshop/db";
import { inShop, type ShopContext } from "./shop";
import { listStaff } from "./sales";

export async function getCommissionSettings(ctx: ShopContext) {
  const [staff, rates] = await Promise.all([
    listStaff(ctx),
    inShop(ctx, (tx) =>
      tx
        .select()
        .from(memberCommissions)
        .where(eq(memberCommissions.organizationId, ctx.organization.id)),
    ),
  ]);
  return staff.map((person) => ({
    ...person,
    percent: rates.find((r) => r.userId === person.id)?.percent ?? 0,
  }));
}

/** Serviços pagos no período por pessoa, com a comissão gravada no fechamento de cada comanda. */
export async function commissionReport(ctx: ShopContext, from: Date, to: Date) {
  return inShop(ctx, (tx) =>
    tx
      .select({
        userId: orderItems.performedBy,
        services: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${orderItems.totalCents}), 0)::int`,
        commissionCents: sql<number>`coalesce(sum(${orderItems.commissionCents}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.organizationId, ctx.organization.id),
          eq(orders.status, "paga"),
          gte(orders.paidAt, from),
          lt(orders.paidAt, to),
          eq(orderItems.kind, "servico"),
          isNotNull(orderItems.performedBy),
        ),
      )
      .groupBy(orderItems.performedBy),
  );
}
