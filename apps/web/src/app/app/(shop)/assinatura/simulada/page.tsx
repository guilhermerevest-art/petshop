import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatBRL, SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Panel, PanelSection } from "@/components/ui/panel";
import { billing } from "@/lib/providers";
import { requireShop } from "@/lib/shop";
import { simulateCheckoutAction, simulateStatusAction } from "@/server/billing-actions";

export const metadata: Metadata = { title: "Assinatura de teste" };

const SCENARIOS = [
  { value: "ativa", label: "Em dia" },
  { value: "atrasado-2", label: "Atrasada há 2 dias (aviso)" },
  { value: "atrasado-10", label: "Atrasada há 10 dias (somente leitura)" },
  { value: "atrasado-31", label: "Atrasada há 31 dias (suspensa)" },
  { value: "cancelada", label: "Cancelada (período encerrado)" },
];

/** Checkout e portal simulados: só existem quando o Stripe não está configurado. */
export default async function FakeCheckoutPage() {
  const provider = billing();
  if (provider.kind !== "fake") notFound();
  const ctx = await requireShop({ allowWithoutAccess: true, capability: "billing.manage" });
  const plan = await provider.getPlan();
  const status = ctx.subscription?.status as SubscriptionStatus | undefined;

  return (
    <>
      <PageHeader title="Pagamento de teste" description="Esta tela substitui o Stripe enquanto ele não está configurado." />
      <Notice tone="warning" className="mb-6 max-w-xl" title="Ambiente de teste">
        Nenhuma cobrança é feita. Configure as chaves do Stripe para cobrar de verdade.
      </Notice>
      {!ctx.subscription ? (
        <Panel className="max-w-xl">
          <PanelSection>
            <p className="font-medium">{plan.name}</p>
            <p className="text-tinta-suave tabular">
              {formatBRL(plan.amountCents)} por mês, {plan.trialDays} dias grátis
            </p>
          </PanelSection>
          <PanelSection>
            <ActionButton action={simulateCheckoutAction} size="lg" pendingLabel="Ativando…">
              Ativar assinatura de teste
            </ActionButton>
          </PanelSection>
        </Panel>
      ) : (
        <Panel className="max-w-xl">
          <PanelSection>
            <p className="font-medium">Status atual: {status ? SUBSCRIPTION_STATUS_LABELS[status] : "—"}</p>
            <p className="mt-1 text-[15px] text-tinta-suave">Simule situações para ver como o sistema reage.</p>
          </PanelSection>
          <PanelSection className="flex flex-col gap-2">
            {SCENARIOS.map((scenario) => (
              <form key={scenario.value} action={simulateStatusAction}>
                <input type="hidden" name="scenario" value={scenario.value} />
                <Button type="submit" variant="secondary" className="w-full justify-start">
                  {scenario.label}
                </Button>
              </form>
            ))}
          </PanelSection>
        </Panel>
      )}
    </>
  );
}
