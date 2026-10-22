import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatBRL, formatTime, utcToZoned } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/format";
import { listOrders } from "@/lib/sales";
import { requireShop } from "@/lib/shop";
import { newOrderAction, openAppointmentOrderAction } from "@/server/sales-actions";

export const metadata: Metadata = { title: "Comandas" };

export default async function OrdersPage(props: PageProps<"/app/comandas">) {
  const ctx = await requireShop({ capability: "sales.manage" });
  const query = await props.searchParams;
  const { open, paidToday, toCharge } = await listOrders(ctx);
  const tz = ctx.profile.timezone;
  const paidTotal = paidToday.reduce((sum, row) => sum + row.order.totalCents, 0);

  return (
    <>
      <PageHeader
        title="Comandas"
        description="O que falta receber e o que já foi pago hoje."
        actions={
          <ActionButton action={newOrderAction} pendingLabel="Abrindo…">
            Nova venda
          </ActionButton>
        }
      />
      {query.cancelada ? (
        <Notice tone="info" className="mb-5">
          Comanda cancelada.
        </Notice>
      ) : null}

      {toCharge.length > 0 ? (
        <section aria-labelledby="cobrar" className="mb-8">
          <h2 id="cobrar" className="mb-3 text-xl">
            Para cobrar
          </h2>
          <ul className="flex flex-col gap-2">
            {toCharge.map((item) => (
              <li
                key={item.appointmentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-painel border border-patinho/60 bg-patinho-claro px-5 py-3"
              >
                <span>
                  <span className="font-medium">{item.pets.join(" e ")}</span>
                  <span className="block text-sm text-tinta-suave">
                    {item.customerName} · {formatTime(utcToZoned(item.startsAt, tz).minutes)}
                  </span>
                </span>
                <ActionButton
                  action={openAppointmentOrderAction}
                  hidden={{ appointmentId: item.appointmentId }}
                  size="sm"
                  pendingLabel="Abrindo…"
                >
                  Cobrar
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="abertas" className="mb-8">
        <h2 id="abertas" className="mb-3 text-xl">
          Abertas
        </h2>
        {open.length === 0 ? (
          <p className="text-tinta-suave">Nenhuma comanda aberta.</p>
        ) : (
          <OrderList rows={open} />
        )}
      </section>

      <section aria-labelledby="pagas">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="pagas" className="text-xl">
            Pagas hoje
          </h2>
          <p className="text-tinta-suave">
            Total <span className="font-[650] text-tinta tabular">{formatBRL(paidTotal)}</span>
          </p>
        </div>
        {paidToday.length === 0 ? (
          <p className="text-tinta-suave">Nenhuma comanda paga hoje.</p>
        ) : (
          <OrderList rows={paidToday} paid />
        )}
      </section>
    </>
  );
}

function OrderList({
  rows,
  paid,
}: {
  rows: {
    order: { id: string; number: number; totalCents: number; createdAt: Date; paidAt: Date | null };
    customerName: string | null;
  }[];
  paid?: boolean;
}) {
  return (
    <ul className="overflow-hidden rounded-painel border border-rejunte bg-rejunte">
      {rows.map(({ order, customerName }) => (
        <li key={order.id} className="[&:not(:first-child)]:mt-px">
          <Link
            href={`/app/comandas/${order.id}`}
            className="flex items-center gap-4 bg-white px-5 py-3.5 hover:bg-espuma"
          >
            <span className="w-14 shrink-0 font-[650] tabular">#{order.number}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {customerName ?? "Venda no balcão"}
              </span>
              <span className="block text-sm text-tinta-suave">
                {paid && order.paidAt
                  ? `Paga em ${formatDateTime(order.paidAt)}`
                  : `Aberta em ${formatDateTime(order.createdAt)}`}
              </span>
            </span>
            <span className="font-medium tabular">{formatBRL(order.totalCents)}</span>
            <ChevronRight className="size-5 text-tinta-suave" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
