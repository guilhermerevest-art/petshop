import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { mapStripeSubscription, StripeBillingProvider } from "../src/billing/stripe";

const subscription = {
  id: "sub_123",
  object: "subscription",
  customer: "cus_123",
  status: "trialing",
  metadata: { organizationId: "org_1" },
  trial_end: 1_800_000_000,
  cancel_at_period_end: false,
  canceled_at: null,
  items: {
    object: "list",
    data: [
      {
        id: "si_1",
        current_period_end: 1_800_000_000,
        price: { id: "price_1", unit_amount: 14900, currency: "brl", recurring: { interval: "month" } },
      },
    ],
  },
} as unknown as Stripe.Subscription;

describe("Stripe", () => {
  it("converte a assinatura para o formato do sistema", () => {
    expect(mapStripeSubscription(subscription)).toEqual({
      organizationId: "org_1",
      provider: "stripe",
      customerId: "cus_123",
      subscriptionId: "sub_123",
      status: "trialing",
      priceId: "price_1",
      amountCents: 14900,
      currency: "brl",
      interval: "month",
      currentPeriodEnd: new Date(1_800_000_000_000),
      trialEnd: new Date(1_800_000_000_000),
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
  });

  it("valida a assinatura do webhook e identifica a assinatura afetada", () => {
    const secret = "whsec_test_secret";
    const provider = new StripeBillingProvider({ secretKey: "sk_test_x", webhookSecret: secret, priceId: "price_1" });
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "invoice.payment_failed",
      data: { object: { id: "in_1", parent: { subscription_details: { subscription: "sub_123" } } } },
    });
    const header = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
    const event = provider.parseWebhook(payload, header);
    expect(event).toMatchObject({ id: "evt_1", type: "invoice.payment_failed", subscriptionId: "sub_123" });
    expect(() => provider.parseWebhook(payload, "t=1,v1=assinatura-falsa")).toThrow();
    expect(() => provider.parseWebhook(payload, null)).toThrow();
  });
});
