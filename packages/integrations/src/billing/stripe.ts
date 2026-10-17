import Stripe from "stripe";
import type { SubscriptionStatus } from "@petshop/core";
import type {
  BillingProvider,
  BillingSubscription,
  BillingWebhookEvent,
  CheckoutParams,
  Plan,
} from "./types";

export interface StripeBillingConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
  trialDays?: number;
}

const KNOWN_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "canceled",
  "incomplete",
  "incomplete_expired",
];

function toStatus(status: string): SubscriptionStatus {
  return (KNOWN_STATUSES as string[]).includes(status) ? (status as SubscriptionStatus) : "incomplete";
}

const fromUnix = (value: number | null | undefined) => (value ? new Date(value * 1000) : null);

/** Eventos do Stripe que mudam a assinatura de um pet shop. */
export const STRIPE_SUBSCRIPTION_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
]);

export function mapStripeSubscription(subscription: Stripe.Subscription): BillingSubscription {
  const item = subscription.items.data[0];
  const price = item?.price;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  return {
    organizationId: subscription.metadata?.organizationId ?? null,
    provider: "stripe",
    customerId,
    subscriptionId: subscription.id,
    status: toStatus(subscription.status),
    priceId: price?.id ?? null,
    amountCents: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    interval: price?.recurring?.interval ?? null,
    // Desde a API 2025-03-31 o período fica no item da assinatura.
    currentPeriodEnd: fromUnix(item?.current_period_end),
    trialEnd: fromUnix(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: fromUnix(subscription.canceled_at),
  };
}

function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) return (object.id as string) ?? null;
  if (event.type === "checkout.session.completed") {
    const subscription = object.subscription;
    return typeof subscription === "string" ? subscription : ((subscription as { id?: string } | null)?.id ?? null);
  }
  if (event.type.startsWith("invoice.")) {
    const parent = object.parent as { subscription_details?: { subscription?: string | { id: string } } } | null;
    const fromParent = parent?.subscription_details?.subscription;
    if (fromParent) return typeof fromParent === "string" ? fromParent : fromParent.id;
    const legacy = object.subscription;
    if (legacy) return typeof legacy === "string" ? legacy : ((legacy as { id: string }).id ?? null);
  }
  return null;
}

export class StripeBillingProvider implements BillingProvider {
  readonly kind = "stripe" as const;
  private readonly stripe: Stripe;
  private planCache: { plan: Plan; at: number } | null = null;

  constructor(private readonly config: StripeBillingConfig) {
    this.stripe = new Stripe(config.secretKey, { appInfo: { name: "petshop" } });
  }

  async getPlan(): Promise<Plan> {
    if (this.planCache && Date.now() - this.planCache.at < 10 * 60_000) return this.planCache.plan;
    const price = await this.stripe.prices.retrieve(this.config.priceId, { expand: ["product"] });
    const product = price.product as Stripe.Product;
    const plan: Plan = {
      name: typeof product === "object" && "name" in product ? product.name : "Plano",
      priceId: price.id,
      amountCents: price.unit_amount ?? 0,
      currency: price.currency,
      interval: price.recurring?.interval === "year" ? "year" : "month",
      trialDays: this.config.trialDays ?? 0,
    };
    this.planCache = { plan, at: Date.now() };
    return plan;
  }

  async createCheckout(params: CheckoutParams): Promise<{ url: string }> {
    const trialDays = this.config.trialDays ?? 0;
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: this.config.priceId, quantity: 1 }],
      client_reference_id: params.organizationId,
      metadata: { organizationId: params.organizationId },
      subscription_data: {
        metadata: { organizationId: params.organizationId, organizationName: params.organizationName },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
      ...(params.existingCustomerId
        ? { customer: params.existingCustomerId, customer_update: { name: "auto", address: "auto" } }
        : { customer_email: params.customerEmail }),
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      locale: "pt-BR",
      success_url: `${params.successUrl}${params.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe não devolveu o endereço do checkout");
    return { url: session.url };
  }

  async createPortal(params: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
      locale: "pt-BR",
    });
    return { url: session.url };
  }

  async getSubscription(subscriptionId: string): Promise<BillingSubscription> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    return mapStripeSubscription(subscription);
  }

  async getCheckoutSubscription(sessionId: string): Promise<BillingSubscription | null> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const subscription = session.subscription;
    if (!subscription || typeof subscription === "string") {
      return typeof subscription === "string" ? this.getSubscription(subscription) : null;
    }
    const mapped = mapStripeSubscription(subscription);
    return { ...mapped, organizationId: mapped.organizationId ?? session.client_reference_id ?? null };
  }

  parseWebhook(rawBody: string, signature: string | null): BillingWebhookEvent {
    if (!signature) throw new Error("Assinatura do webhook ausente");
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    return { id: event.id, type: event.type, subscriptionId: subscriptionIdFromEvent(event), payload: event };
  }
}
