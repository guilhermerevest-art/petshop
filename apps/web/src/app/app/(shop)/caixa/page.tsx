import type { Metadata } from "next";
import Link from "next/link";
import { formatBRL } from "@petshop/core";
import { PAYMENT_METHODS } from "@petshop/db/schema";
import { CloseCashForm, OpenCashForm } from "@/components/sales/cash-forms";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, PanelSection } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/format";
import { getCashState, PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Caixa" };

export default async function CashPage() {
  const ctx = await requireShop({ capability: "sales.manage" });
  const { session, summary, sessionPayments, pendingPix, history } = await getCashState(ctx);

  return (
    <>
      <PageHeader
        title="Caixa"
        description={
          session
            ? `Aberto em ${formatDateTime(session.openedAt)}.`
            : "Abra o caixa no começo do dia e feche no fim."
        }
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {pendingPix.length > 0 ? (
          <Panel>
            <PanelSection className="flex flex-col gap-3">
              <h2 className="text-lg">PIX aguardando conferência</h2>
              <ul className="flex flex-col gap-2">
                {pendingPix.map(({ payment, orderNumber, orderId, customerName }) => (
                  <li key={payment.id}>
                    <Link
                      href={`/app/comandas/${orderId}`}
                      className="flex items-center justify-between gap-3 rounded-campo bg-patinho-claro px-4 py-3 hover:brightness-95"
                    >
                      <span>
                        Comanda #{orderNumber} · {customerName ?? "balcão"}
                      </span>
                      <span className="font-medium tabular">{formatBRL(payment.amountCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PanelSection>
          </Panel>
        ) : null}

        {session && summary ? (
          <>
            <dl className="grid grid-cols-2 gap-[3px] overflow-hidden rounded-painel bg-rejunte p-[3px] sm:grid-cols-4">
              {PAYMENT_METHODS.map((method) => (
                <div key={method} className="rounded-azulejo bg-white px-4 py-3">
                  <dt className="text-sm text-tinta-suave">{PAYMENT_METHOD_LABELS[method]}</dt>
                  <dd className="text-xl font-[650] tabular">
                    {formatBRL(summary.byMethod[method])}
                  </dd>
                </div>
              ))}
            </dl>
            <Panel>
              <PanelSection className="flex flex-wrap justify-between gap-4">
                <p>
                  <span className="block text-sm text-tinta-suave">Recebido no caixa</span>
                  <span className="text-2xl font-[650] tabular">
                    {formatBRL(summary.confirmedCents)}
                  </span>
                </p>
                <p>
                  <span className="block text-sm text-tinta-suave">
                    Dinheiro esperado na gaveta
                  </span>
                  <span className="text-2xl font-[650] tabular">
                    {formatBRL(summary.expectedCashCents)}
                  </span>
                  <span className="block text-sm text-tinta-suave">
                    troco inicial {formatBRL(session.openingCents)} + dinheiro{" "}
                    {formatBRL(summary.byMethod.dinheiro)}
                  </span>
                </p>
              </PanelSection>
              <PanelSection>
                <h2 className="mb-4 text-lg">Fechar o caixa</h2>
                <CloseCashForm expectedCents={summary.expectedCashCents} />
              </PanelSection>
            </Panel>
            <section aria-labelledby="movimento">
              <h2 id="movimento" className="mb-3 text-xl">
                Movimento
              </h2>
              {sessionPayments.length === 0 ? (
                <p className="text-tinta-suave">Nenhum pagamento ainda.</p>
              ) : (
                <ul className="overflow-hidden rounded-painel border border-rejunte bg-white">
                  {sessionPayments.map(({ payment, orderNumber, orderId, customerName }) => (
                    <li key={payment.id} className="border-b border-rejunte last:border-b-0">
                      <Link
                        href={`/app/comandas/${orderId}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-espuma"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            #{orderNumber} · {customerName ?? "balcão"}
                          </span>
                          <span className="block text-sm text-tinta-suave">
                            {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                            {formatDateTime(payment.createdAt)}
                          </span>
                        </span>
                        {payment.status === "pendente" ? (
                          <Badge tone="attention">Conferir</Badge>
                        ) : null}
                        <span className="tabular">{formatBRL(payment.amountCents)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <Panel>
            <PanelSection>
              <OpenCashForm />
            </PanelSection>
          </Panel>
        )}

        {history.length > 0 ? (
          <section aria-labelledby="anteriores">
            <h2 id="anteriores" className="mb-3 text-xl">
              Fechamentos anteriores
            </h2>
            <ul className="overflow-hidden rounded-painel border border-rejunte bg-white">
              {history.map(({ session: s, closedByName }) => {
                const diff = (s.countedCents ?? 0) - (s.expectedCents ?? 0);
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-rejunte px-5 py-3 last:border-b-0"
                  >
                    <span>
                      <span className="block font-medium">
                        {s.closedAt ? formatDateTime(s.closedAt) : ""}
                      </span>
                      <span className="block text-sm text-tinta-suave">
                        {closedByName ?? ""} · esperado {formatBRL(s.expectedCents ?? 0)}, contado{" "}
                        {formatBRL(s.countedCents ?? 0)}
                      </span>
                    </span>
                    {diff === 0 ? (
                      <Badge tone="ok">Bateu</Badge>
                    ) : (
                      <Badge tone="attention">
                        {diff > 0 ? "Sobra" : "Falta"} {formatBRL(Math.abs(diff))}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
