import "server-only";
import {
  ConsoleMailer,
  EvolutionProvider,
  FakeBillingProvider,
  FakeMessagingProvider,
  SmtpMailer,
  StripeBillingProvider,
  type BillingProvider,
  type Mailer,
  type MessagingProvider,
} from "@petshop/integrations";
import { env } from "./env";

type Providers = {
  billing?: BillingProvider;
  messaging?: MessagingProvider;
  mailer?: Mailer;
};

// Guardado no globalThis para sobreviver ao recarregamento em desenvolvimento (o simulador de WhatsApp
// mantém estado em memória).
const store = globalThis as unknown as { __petshopProviders?: Providers };
const providers = (store.__petshopProviders ??= {});

export function billing(): BillingProvider {
  if (providers.billing) return providers.billing;
  const e = env();
  const kind =
    e.BILLING_PROVIDER ??
    (e.STRIPE_SECRET_KEY ? "stripe" : e.NODE_ENV === "production" ? "stripe" : "fake");
  if (kind === "stripe") {
    if (!e.STRIPE_SECRET_KEY || !e.STRIPE_WEBHOOK_SECRET || !e.STRIPE_PRICE_ID) {
      throw new Error("Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET e STRIPE_PRICE_ID.");
    }
    providers.billing = new StripeBillingProvider({
      secretKey: e.STRIPE_SECRET_KEY,
      webhookSecret: e.STRIPE_WEBHOOK_SECRET,
      priceId: e.STRIPE_PRICE_ID,
      trialDays: e.BILLING_TRIAL_DAYS,
    });
  } else {
    providers.billing = new FakeBillingProvider({
      checkoutPath: "/app/assinatura/simulada",
      portalPath: "/app/assinatura/simulada",
      plan: { trialDays: e.BILLING_TRIAL_DAYS },
    });
  }
  return providers.billing;
}

export function messaging(): MessagingProvider {
  if (providers.messaging) return providers.messaging;
  const e = env();
  const kind =
    e.MESSAGING_PROVIDER ??
    (e.EVOLUTION_API_URL ? "evolution" : e.NODE_ENV === "production" ? "evolution" : "fake");
  if (kind === "evolution") {
    if (!e.EVOLUTION_API_URL || !e.EVOLUTION_API_KEY) {
      throw new Error("Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.");
    }
    providers.messaging = new EvolutionProvider({
      baseUrl: e.EVOLUTION_API_URL,
      apiKey: e.EVOLUTION_API_KEY,
    });
  } else {
    providers.messaging = new FakeMessagingProvider(e.FAKE_WHATSAPP_CONNECT_MS);
  }
  return providers.messaging;
}

export function mailer(): Mailer {
  if (providers.mailer) return providers.mailer;
  const e = env();
  providers.mailer = e.SMTP_URL ? new SmtpMailer(e.SMTP_URL, e.EMAIL_FROM) : new ConsoleMailer();
  return providers.mailer;
}
