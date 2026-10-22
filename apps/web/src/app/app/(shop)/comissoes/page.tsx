import type { Metadata } from "next";
import { addDays, formatBRL, isLocalDate, todayIn, zonedToUtc } from "@petshop/core";
import { CommissionForm } from "@/components/sales/commission-form";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader, Panel, PanelSection } from "@/components/ui/panel";
import { commissionReport, getCommissionSettings } from "@/lib/commissions";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Comissões" };

export default async function CommissionsPage(props: PageProps<"/app/comissoes">) {
  const ctx = await requireShop({ capability: "commissions.manage" });
  const query = await props.searchParams;
  const tz = ctx.profile.timezone;
  const today = todayIn(tz);
  const monthStart = `${today.slice(0, 8)}01`;
  const from =
    typeof query.inicio === "string" && isLocalDate(query.inicio) ? query.inicio : monthStart;
  const to =
    typeof query.fim === "string" && isLocalDate(query.fim) && query.fim >= from
      ? query.fim
      : today;
  const [people, report] = await Promise.all([
    getCommissionSettings(ctx),
    commissionReport(ctx, zonedToUtc(from, 0, tz), zonedToUtc(addDays(to, 1), 0, tz)),
  ]);
  const rows = people
    .map((person) => ({ person, data: report.find((r) => r.userId === person.id) }))
    .filter((r) => r.data || r.person.percent > 0);
  const total = report.reduce((sum, r) => sum + r.commissionCents, 0);

  return (
    <>
      <PageHeader
        title="Comissões"
        description="Opcional. Defina o percentual de quem faz os serviços; a comissão é calculada quando a comanda é paga."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="self-start">
          <PanelSection>
            <form className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5 text-[15px] font-medium">
                De
                <input
                  type="date"
                  name="inicio"
                  defaultValue={from}
                  className="h-11 rounded-campo border border-rejunte-forte px-3 tabular"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[15px] font-medium">
                Até
                <input
                  type="date"
                  name="fim"
                  defaultValue={to}
                  className="h-11 rounded-campo border border-rejunte-forte px-3 tabular"
                />
              </label>
              <button type="submit" className={buttonClasses({ variant: "secondary" })}>
                Ver período
              </button>
            </form>
          </PanelSection>
          <PanelSection>
            {rows.length === 0 ? (
              <p className="text-tinta-suave">Nenhum serviço pago com responsável neste período.</p>
            ) : (
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="text-left text-sm text-tinta-suave">
                    <th className="pb-2 font-medium">Pessoa</th>
                    <th className="pb-2 text-right font-medium">Serviços</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="pb-2 text-right font-medium">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ person, data }) => (
                    <tr key={person.id} className="border-t border-rejunte">
                      <td className="py-2.5">
                        {person.name}
                        <span className="block text-sm text-tinta-suave">
                          {person.percent ? `${person.percent}%` : "sem comissão"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular">{data?.services ?? 0}</td>
                      <td className="py-2.5 text-right tabular">
                        {formatBRL(data?.totalCents ?? 0)}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular">
                        {formatBRL(data?.commissionCents ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-rejunte-forte">
                    <td colSpan={3} className="pt-2.5 font-medium">
                      Total
                    </td>
                    <td className="pt-2.5 text-right font-[650] tabular">{formatBRL(total)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </PanelSection>
        </Panel>
        <Panel className="self-start">
          <PanelSection>
            <h2 className="mb-1 text-lg">Percentual por pessoa</h2>
            <p className="mb-4 text-sm text-tinta-suave">
              Deixe em branco para quem não recebe comissão.
            </p>
            <CommissionForm people={people} />
          </PanelSection>
        </Panel>
      </div>
    </>
  );
}
