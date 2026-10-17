import "server-only";
import { eq, or } from "drizzle-orm";
import type { BillingSubscription } from "@petshop/integrations";
import { STRIPE_SUBSCRIPTION_EVENTS } from "@petshop/integrations";
import { subscriptions, webhookEvents, withSystem } from "@petshop/db";
import { audit } from "./audit";
import { db } from "./db";
import { billing } from "./providers";

/**
 * Grava a assinatura do pet shop a partir do provedor (RN-17: o status sempre vem do Stripe).
 * Guarda desde quando o pagamento está atrasado, para aplicar os prazos de RN-16.
 */
export async function saveSubscription(organizationId: string, sub: BillingSubscription): Promise<void> {
  await withSystem(db(), async (tx) => {
    const existing = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, organizationId),
    });
    const overdue = sub.status === "past_due" || sub.status === "unpaid";
    const values = {
      organizationId,
      provider: sub.provider,
      customerId: sub.customerId,
      subscriptionId: sub.subscriptionId,
      status: sub.status,
      priceId: sub.priceId,
      amountCents: sub.amountCents,
      currency: sub.currency,
      interval: sub.interval,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt,
      pastDueSince: overdue ? (existing?.pastDueSince ?? new Date()) : null,
    };
    await tx.insert(subscriptions).values(values).onConflictDoUpdate({ target: subscriptions.organizationId, set: values });
    if (existing?.status !== sub.status) {
      await audit(tx, { organizationId, userId: null }, "assinatura.status", {
        entity: "subscription",
        entityId: sub.subscriptionId ?? undefined,
        data: { de: existing?.status ?? null, para: sub.status },
      });
    }
  });
}

/** Descobre o pet shop de uma assinatura: pelos metadados ou pelo que já está gravado. */
async function organizationFor(sub: BillingSubscription): Promise<string | null> {
  if (sub.organizationId) return sub.organizationId;
  return withSystem(db(), async (tx) => {
    const conditions = [
      sub.subscriptionId ? eq(subscriptions.subscriptionId, sub.subscriptionId) : undefined,
      sub.customerId ? eq(subscriptions.customerId, sub.customerId) : undefined,
    ].filter((c) => c !== undefined);
    if (conditions.length === 0) return null;
    const row = await tx.query.subscriptions.findFirst({ where: or(...conditions) });
    return row?.organizationId ?? null;
  });
}

export async function syncSubscription(sub: BillingSubscription): Promise<string | null> {
  const organizationId = await organizationFor(sub);
  if (!organizationId) return null;
  await saveSubscription(organizationId, sub);
  return organizationId;
}

/** Processa um webhook do Stripe uma única vez por evento. */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ status: number; message: string }> {
  let event;
  try {
    event = billing().parseWebhook(rawBody, signature);
  } catch {
    return { status: 400, message: "Assinatura do webhook inválida" };
  }

  const fresh = await withSystem(db(), async (tx) => {
    const [inserted] = await tx
      .insert(webhookEvents)
      .values({ source: "stripe", externalId: event.id, type: event.type, payload: event.payload as object })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (inserted) return true;
    const previous = await tx.query.webhookEvents.findFirst({
      where: (t, { and, eq: equals }) => and(equals(t.source, "stripe"), equals(t.externalId, event.id)),
    });
    return !previous?.processedAt;
  });
  if (!fresh) return { status: 200, message: "Evento já processado" };

  let error: string | null = null;
  if (STRIPE_SUBSCRIPTION_EVENTS.has(event.type) && event.subscriptionId) {
    try {
      // Sempre consulta a assinatura atual: eventos podem chegar fora de ordem.
      const sub = await billing().getSubscription(event.subscriptionId);
      const organizationId = await syncSubscription(sub);
      if (!organizationId) error = "Pet shop da assinatura não encontrado";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  await withSystem(db(), (tx) =>
    tx
      .update(webhookEvents)
      .set({ processedAt: error ? null : new Date(), error })
      .where(eq(webhookEvents.externalId, event.id)),
  );
  // Erro devolve 500 para o Stripe tentar de novo mais tarde.
  return error ? { status: 500, message: error } : { status: 200, message: "ok" };
}
