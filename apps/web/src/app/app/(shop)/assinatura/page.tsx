import type { Metadata } from "next";
import { Check } from "lucide-react";
import { formatBRL, SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Panel, PanelSection } from "@/components/ui/panel";
import { formatDate, formatInterval } from "@/lib/format";
import { can } from "@/lib/permissions";
import { billing } from "@/lib/providers";
import { requireShop } from "@/lib/shop";
import { openPortalAction, startCheckoutAction } from "@/server/billing-actions";

export const metadata: Metadata = { title: "Assinatura" };

const INCLUDED = [
  "Equipe sem limite de pessoas",
  "WhatsApp do seu próprio número",
  "PIX direto na sua conta, sem taxa por venda",
  "Agenda por vagas, checklist e histórico de cada pet",
  "Portal para o tutor agendar sozinho",
];

export default async function SubscriptionPage() {
  const ctx = await requireShop({ allowWithoutAccess: true });
  const canManage = can(ctx.role, "billing.manage");
  const provider = billing();
  const plan = await provider.getPlan().catch((error) => {
    console.error("getPlan", error);
    return null;
  });
  const sub = ctx.subscription;
  const status = sub?.status as SubscriptionStatus | undefined;

  if (!canManage) {
    return (
      <>
        <PageHeader title="Assinatura" />
        <Notice tone={ctx.access.canUseApp ? "info" : "warning"} title={ctx.access.canUseApp ? "A assinatura está em dia." : "A assinatura do pet shop não está ativa."}>
          Só o dono do pet shop pode ver e alterar a assinatura.
        </Notice>
      </>
    );
  }

  if (!sub || ctx.access.mode === "needs_subscription") {
    return (
      <>
        <PageHeader
          title="Ative a assinatura do pet shop"
          description="Depois de ativar, você configura horários, serviços, PIX e WhatsApp em poucos minutos."
        />
        <Panel className="max-w-xl">
          <PanelSection>
            <p className="text-lg font-[650]">{plan?.name ?? "Plano PetShop"}</p>
            {plan ? (
              <p className="mt-1">
                <span className="text-[36px] font-[650] tabular">{formatBRL(plan.amountCents)}</span>{" "}
                <span className="text-tinta-suave">{formatInterval(plan.interval)}</span>
              </p>
            ) : null}
            {plan && plan.trialDays > 0 ? (
              <p className="mt-2 font-medium text-azulejo-escuro">
                {plan.trialDays} dias grátis. A primeira cobrança só acontece depois do teste.
              </p>
            ) : null}
          </PanelSection>
          <PanelSection>
            <ul className="flex flex-col gap-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 size-5 shrink-0 text-azulejo" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </PanelSection>
          <PanelSection className="flex flex-col gap-3">
            <ActionButton action={startCheckoutAction} size="lg" pendingLabel="Abrindo pagamento…">
              {plan && plan.trialDays > 0 ? "Começar teste grátis" : "Assinar"}
            </ActionButton>
            <p className="text-sm text-tinta-suave">
              {provider.kind === "fake"
                ? "Ambiente de teste: nenhuma cobrança será feita."
                : "Pagamento seguro pelo Stripe. Cancele quando quiser, sem multa."}
            </p>
          </PanelSection>
        </Panel>
      </>
    );
  }

  const tone =
    ctx.access.mode === "full" ? "ok" : ctx.access.mode === "warning" ? "attention" : "danger";
  return (
    <>
      <PageHeader title="Assinatura" description="Plano, próxima cobrança e forma de pagamento." />
      {ctx.access.mode === "read_only" || ctx.access.mode === "suspended" ? (
        <Notice tone="error" className="mb-6 max-w-xl" title="A assinatura não está em dia.">
          {status === "canceled"
            ? "Para voltar a usar o sistema, assine de novo. Seus dados continuam guardados."
            : "Atualize a forma de pagamento para voltar a usar tudo."}
        </Notice>
      ) : null}
      <Panel className="max-w-xl">
        <PanelSection className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-[650]">{plan?.name ?? "Plano PetShop"}</p>
            {sub.amountCents ? (
              <p className="mt-1 text-tinta-suave tabular">
                {formatBRL(sub.amountCents)} {formatInterval(sub.interval)}
              </p>
            ) : null}
          </div>
          <Badge tone={tone}>{status ? SUBSCRIPTION_STATUS_LABELS[status] : "Sem assinatura"}</Badge>
        </PanelSection>
        <PanelSection>
          <dl className="grid gap-4 sm:grid-cols-2">
            {status === "trialing" && sub.trialEnd ? (
              <div>
                <dt className="text-sm text-tinta-suave">Teste grátis até</dt>
                <dd className="font-medium">{formatDate(sub.trialEnd)}</dd>
              </div>
            ) : null}
            {sub.currentPeriodEnd ? (
              <div>
                <dt className="text-sm text-tinta-suave">
                  {sub.cancelAtPeriodEnd || status === "canceled" ? "Acesso até" : "Próxima cobrança"}
                </dt>
                <dd className="font-medium">{formatDate(sub.currentPeriodEnd)}</dd>
              </div>
            ) : null}
          </dl>
          {sub.cancelAtPeriodEnd && status !== "canceled" ? (
            <p className="mt-4 text-[15px] text-tinta-suave">
              A assinatura foi cancelada e termina no fim do período pago. Você pode desfazer o cancelamento no portal de pagamento.
            </p>
          ) : null}
        </PanelSection>
        <PanelSection className="flex flex-col gap-3 sm:flex-row">
          {status === "canceled" || status === "incomplete_expired" ? (
            <ActionButton action={startCheckoutAction} size="lg" pendingLabel="Abrindo pagamento…">
              Assinar de novo
            </ActionButton>
          ) : (
            <ActionButton action={openPortalAction} variant="secondary" size="lg" pendingLabel="Abrindo…">
              Gerenciar pagamento e faturas
            </ActionButton>
          )}
        </PanelSection>
      </Panel>
      <p className="mt-4 max-w-xl text-sm text-tinta-suave">
        No portal de pagamento você troca o cartão, baixa faturas e cancela a assinatura.
      </p>
    </>
  );
}
