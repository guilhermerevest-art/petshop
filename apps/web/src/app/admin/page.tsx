import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, desc, eq, sql } from "drizzle-orm";
import { formatBRL, formatBrPhone, SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@petshop/core";
import { member, organization, subscriptions, whatsappInstances, withSystem } from "@petshop/db";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/env";
import { formatShortDate } from "@/lib/format";
import { requireUser } from "@/lib/shop";

export const metadata: Metadata = { title: "Painel da plataforma" };

function monthly(amountCents: number | null, interval: string | null): number {
  if (!amountCents) return 0;
  return interval === "year" ? Math.round(amountCents / 12) : amountCents;
}

export default async function AdminPage() {
  const session = await requireUser("/admin");
  if (!isPlatformAdmin(session.user.email)) notFound();

  const rows = await withSystem(db(), (tx) =>
    tx
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        status: subscriptions.status,
        amountCents: subscriptions.amountCents,
        interval: subscriptions.interval,
        trialEnd: subscriptions.trialEnd,
        whatsappStatus: whatsappInstances.status,
        whatsappPhone: whatsappInstances.phoneNumber,
        members: sql<number>`(select ${count()} from ${member} where ${member.organizationId} = ${organization.id})`.mapWith(Number),
      })
      .from(organization)
      .leftJoin(subscriptions, eq(subscriptions.organizationId, organization.id))
      .leftJoin(whatsappInstances, eq(whatsappInstances.organizationId, organization.id))
      .orderBy(desc(organization.createdAt)),
  );

  const paying = rows.filter((r) => r.status === "active");
  const trialing = rows.filter((r) => r.status === "trialing");
  const overdue = rows.filter((r) => r.status === "past_due" || r.status === "unpaid");
  const mrr = paying.reduce((sum, r) => sum + monthly(r.amountCents, r.interval), 0);
  const connected = rows.filter((r) => r.whatsappStatus === "connected").length;

  const kpis = [
    { label: "Pet shops", value: String(rows.length) },
    { label: "Pagantes", value: String(paying.length) },
    { label: "Em teste", value: String(trialing.length) },
    { label: "Pagamento atrasado", value: String(overdue.length) },
    { label: "Receita mensal (MRR)", value: formatBRL(mrr) },
    { label: "WhatsApp conectado", value: `${connected} de ${rows.length}` },
  ];

  return (
    <div className="min-h-dvh px-4 py-6 sm:px-8">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between">
        <Brand />
        <Link href="/app" className="text-[15px] font-medium text-azulejo underline underline-offset-2">
          Voltar ao pet shop
        </Link>
      </header>
      <main className="mx-auto mt-10 max-w-[1200px]">
        <h1 className="text-[30px]">Painel da plataforma</h1>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-painel border border-rejunte bg-rejunte md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white px-4 py-4">
              <dt className="text-sm text-tinta-suave">{kpi.label}</dt>
              <dd className="mt-1 text-2xl font-[650] tabular">{kpi.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 overflow-x-auto rounded-painel border border-rejunte bg-white">
          <table className="w-full min-w-[820px] text-left text-[15px]">
            <thead className="border-b border-rejunte text-sm text-tinta-suave">
              <tr>
                <th className="px-4 py-3 font-medium">Pet shop</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Assinatura</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rejunte">
              {rows.map((row) => {
                const status = row.status as SubscriptionStatus | null;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{row.name}</span>
                      <span className="text-sm text-tinta-suave">{row.slug}</span>
                    </td>
                    <td className="px-4 py-3 tabular">{formatShortDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      {status ? (
                        <Badge tone={status === "active" ? "ok" : status === "trialing" ? "neutral" : "attention"}>
                          {SUBSCRIPTION_STATUS_LABELS[status]}
                        </Badge>
                      ) : (
                        <Badge>Sem assinatura</Badge>
                      )}
                      {status === "trialing" && row.trialEnd ? (
                        <span className="mt-1 block text-sm text-tinta-suave">até {formatShortDate(row.trialEnd)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular">{row.amountCents ? formatBRL(monthly(row.amountCents, row.interval)) : ""}</td>
                    <td className="px-4 py-3">
                      {row.whatsappStatus === "connected" ? (
                        <span>{row.whatsappPhone ? formatBrPhone(row.whatsappPhone) : "Conectado"}</span>
                      ) : (
                        <span className="text-tinta-suave">{row.whatsappStatus === "connecting" ? "Conectando" : "Desconectado"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular">{row.members}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-4 py-8 text-center text-tinta-suave">Nenhum pet shop ainda.</p> : null}
        </div>
      </main>
    </div>
  );
}
