"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { FakeBillingProvider } from "@petshop/integrations";
import { subscriptions, withSystem } from "@petshop/db";
import { saveSubscription } from "@/lib/billing";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { billing } from "@/lib/providers";
import { fail, shopForAction, type ActionResult } from "@/lib/shop";

export async function startCheckoutAction(_: ActionResult | null): Promise<ActionResult> {
  const ctx = await shopForAction("billing.manage", { write: false });
  if ("error" in ctx) return fail(ctx.error);
  let url: string;
  try {
    ({ url } = await billing().createCheckout({
      organizationId: ctx.organization.id,
      organizationName: ctx.organization.name,
      customerEmail: ctx.user.email,
      customerName: ctx.user.name,
      existingCustomerId: ctx.subscription?.customerId ?? null,
      successUrl: appUrl("/app/assinatura/retorno"),
      cancelUrl: appUrl("/app/assinatura"),
    }));
  } catch (error) {
    console.error("startCheckout", error);
    return fail("Não foi possível abrir a página de pagamento agora. Tente de novo em instantes.");
  }
  redirect(url);
}

export async function openPortalAction(_: ActionResult | null): Promise<ActionResult> {
  const ctx = await shopForAction("billing.manage", { write: false });
  if ("error" in ctx) return fail(ctx.error);
  const customerId = ctx.subscription?.customerId;
  if (!customerId) return fail("Ainda não há assinatura para gerenciar.");
  let url: string;
  try {
    ({ url } = await billing().createPortal({ customerId, returnUrl: appUrl("/app/assinatura") }));
  } catch (error) {
    console.error("openPortal", error);
    return fail("Não foi possível abrir o portal de pagamento agora. Tente de novo em instantes.");
  }
  redirect(url);
}

function fakeBilling(): FakeBillingProvider | null {
  const provider = billing();
  return provider instanceof FakeBillingProvider ? provider : null;
}

/** Só no modo de teste: ativa a assinatura sem cobrança. */
export async function simulateCheckoutAction(_: ActionResult | null): Promise<ActionResult> {
  const provider = fakeBilling();
  if (!provider) return fail("Disponível só no modo de teste.");
  const ctx = await shopForAction("billing.manage", { write: false });
  if ("error" in ctx) return fail(ctx.error);
  await saveSubscription(
    ctx.organization.id,
    await provider.simulateSubscription(ctx.organization.id),
  );
  redirect("/app/configurar");
}

/** Só no modo de teste: muda o status para conferir avisos, somente leitura e suspensão. */
export async function simulateStatusAction(formData: FormData): Promise<void> {
  if (!fakeBilling()) return;
  const ctx = await shopForAction("billing.manage", { write: false });
  if ("error" in ctx) return;
  const scenario = String(formData.get("scenario"));
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
  const changes =
    scenario === "atrasado-2"
      ? { status: "past_due", pastDueSince: daysAgo(2) }
      : scenario === "atrasado-10"
        ? { status: "past_due", pastDueSince: daysAgo(10) }
        : scenario === "atrasado-31"
          ? { status: "past_due", pastDueSince: daysAgo(31) }
          : scenario === "cancelada"
            ? {
                status: "canceled",
                currentPeriodEnd: daysAgo(1),
                canceledAt: daysAgo(1),
                pastDueSince: null,
              }
            : {
                status: "active",
                pastDueSince: null,
                canceledAt: null,
                currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
              };
  await withSystem(db(), (tx) =>
    tx
      .update(subscriptions)
      .set(changes)
      .where(eq(subscriptions.organizationId, ctx.organization.id)),
  );
  redirect("/app/assinatura/simulada");
}
