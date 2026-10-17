import { randomUUID } from "node:crypto";
import type {
  BillingProvider,
  BillingSubscription,
  BillingWebhookEvent,
  CheckoutParams,
  Plan,
} from "./types";

/**
 * Simulador de cobrança para desenvolvimento e testes. O "checkout" é uma página do próprio sistema
 * (`checkoutPath`) que ativa a assinatura sem cobrar nada.
 */
export class FakeBillingProvider implements BillingProvider {
  readonly kind = "fake" as const;

  constructor(
    private readonly options: { checkoutPath: string; portalPath: string; plan?: Partial<Plan> },
  ) {}

  async getPlan(): Promise<Plan> {
    return {
      name: "Plano PetShop",
      priceId: null,
      amountCents: 14_900,
      currency: "brl",
      interval: "month",
      trialDays: 14,
      ...this.options.plan,
    };
  }

  async createCheckout(params: CheckoutParams): Promise<{ url: string }> {
    const url = new URL(this.options.checkoutPath, params.successUrl);
    url.searchParams.set("org", params.organizationId);
    return { url: url.toString() };
  }

  async createPortal(params: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const url = new URL(this.options.portalPath, params.returnUrl);
    return { url: url.toString() };
  }

  /** Assinatura que o simulador "cria" quando a pessoa confirma o checkout de teste. */
  async simulateSubscription(organizationId: string): Promise<BillingSubscription> {
    const plan = await this.getPlan();
    const now = Date.now();
    const trialEnd = plan.trialDays > 0 ? new Date(now + plan.trialDays * 86_400_000) : null;
    return {
      organizationId,
      provider: "fake",
      customerId: `fake_cus_${organizationId}`,
      subscriptionId: `fake_sub_${randomUUID()}`,
      status: trialEnd ? "trialing" : "active",
      priceId: null,
      amountCents: plan.amountCents,
      currency: plan.currency,
      interval: plan.interval,
      currentPeriodEnd: trialEnd ?? new Date(now + 30 * 86_400_000),
      trialEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    };
  }

  async getSubscription(): Promise<BillingSubscription> {
    throw new Error("O simulador não consulta assinaturas: elas ficam só no banco");
  }

  async getCheckoutSubscription(): Promise<BillingSubscription | null> {
    return null;
  }

  parseWebhook(): BillingWebhookEvent {
    throw new Error("O simulador não recebe webhooks");
  }
}
