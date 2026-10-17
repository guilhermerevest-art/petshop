import type { SubscriptionStatus } from "@petshop/core";

export interface Plan {
  name: string;
  priceId: string | null;
  amountCents: number;
  currency: string;
  interval: "month" | "year";
  trialDays: number;
}

export interface CheckoutParams {
  organizationId: string;
  organizationName: string;
  customerEmail: string;
  customerName: string;
  /** Cliente já criado numa tentativa anterior, para não duplicar no Stripe. */
  existingCustomerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}

/** Retrato da assinatura no provedor, já no formato que o sistema grava. */
export interface BillingSubscription {
  organizationId: string | null;
  provider: "stripe" | "fake";
  customerId: string | null;
  subscriptionId: string | null;
  status: SubscriptionStatus;
  priceId: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: string | null;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}

export interface BillingWebhookEvent {
  id: string;
  type: string;
  /** Assinatura afetada, quando o evento se refere a uma. */
  subscriptionId: string | null;
  payload: unknown;
}

/** Cobrança da mensalidade dos pet shops. Implementado pelo Stripe e por um simulador para desenvolvimento. */
export interface BillingProvider {
  readonly kind: "stripe" | "fake";
  getPlan(): Promise<Plan>;
  createCheckout(params: CheckoutParams): Promise<{ url: string }>;
  /** Portal para trocar cartão, ver faturas e cancelar. */
  createPortal(params: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  getSubscription(subscriptionId: string): Promise<BillingSubscription>;
  /** Assinatura criada por um checkout concluído (usado no retorno, antes do webhook chegar). */
  getCheckoutSubscription(sessionId: string): Promise<BillingSubscription | null>;
  /** Valida a assinatura do webhook e devolve o evento; lança erro se for inválido. */
  parseWebhook(rawBody: string, signature: string | null): BillingWebhookEvent;
}
