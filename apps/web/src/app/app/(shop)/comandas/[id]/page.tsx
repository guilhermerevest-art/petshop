import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeft, ExternalLink, Trash2 } from "lucide-react";
import { formatBRL, formatBrPhone, formatTime, utcToZoned } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { AddItem } from "@/components/sales/add-item";
import { CancelOrder } from "@/components/sales/cancel-order";
import { DiscountForm } from "@/components/sales/discount-form";
import { PaymentForm } from "@/components/sales/payment-form";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelSection } from "@/components/ui/panel";
import { listBookableServices } from "@/lib/agenda";
import { appUrl } from "@/lib/env";
import { formatDateTime, formatShortDate } from "@/lib/format";
import {
  getOrder,
  listSellableProducts,
  listStaff,
  PAYMENT_METHOD_LABELS,
  pixPayloadFor,
} from "@/lib/sales";
import { requireShop } from "@/lib/shop";
import {
  cancelPaymentAction,
  closeFreeOrderAction,
  confirmPaymentAction,
  removeOrderItemAction,
  resendReceiptAction,
  sendPixAction,
} from "@/server/sales-actions";

export const metadata: Metadata = { title: "Comanda" };

const STATUS = {
  aberta: { label: "Aberta", tone: "attention" },
  paga: { label: "Paga", tone: "ok" },
  cancelada: { label: "Cancelada", tone: "danger" },
} as const;

export default async function OrderPage(props: PageProps<"/app/comandas/[id]">) {
  const { id } = await props.params;
  const ctx = await requireShop({ capability: "sales.manage" });
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getOrder(ctx, id);
  if (!data) notFound();
  const { order, items, customer, appointment } = data;
  const open = order.status === "aberta";
  const editable = open && data.payments.length === 0;
  const [services, products, staff, hasPix] = await Promise.all([
    editable ? listBookableServices(ctx) : Promise.resolve([]),
    editable ? listSellableProducts(ctx) : Promise.resolve([]),
    editable ? listStaff(ctx) : Promise.resolve([]),
    open ? pixPayloadFor(ctx, 100, order.number).then(Boolean) : Promise.resolve(false),
  ]);
  const pendingPix = await Promise.all(
    data.payments
      .filter((p) => p.status === "pendente")
      .map(async (payment) => {
        const payload = await pixPayloadFor(ctx, payment.amountCents, order.number);
        const qr = payload
          ? await QRCode.toDataURL(payload, {
              margin: 1,
              width: 220,
              color: { dark: "#10293a", light: "#ffffff" },
            })
          : null;
        return { payment, payload, qr };
      }),
  );
  const local = appointment ? utcToZoned(appointment.startsAt, ctx.profile.timezone) : null;

  return (
    <>
      <Link
        href="/app/comandas"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-tinta-suave hover:text-tinta"
      >
        <ChevronLeft className="size-4" aria-hidden /> Comandas
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-[28px] sm:text-[32px]">
            Comanda {order.number}
            <Badge tone={STATUS[order.status].tone}>{STATUS[order.status].label}</Badge>
          </h1>
          <p className="mt-1 text-tinta-suave">
            {customer ? (
              <>
                <Link
                  href={`/app/clientes/${customer.id}`}
                  className="font-medium text-tinta hover:underline"
                >
                  {customer.name}
                </Link>{" "}
                · <span className="tabular">{formatBrPhone(customer.phone)}</span>
              </>
            ) : (
              "Venda no balcão"
            )}
            {appointment && local ? (
              <>
                {" · "}
                <Link
                  href={`/app/agenda/${appointment.id}`}
                  className="underline underline-offset-2"
                >
                  atendimento de {formatShortDate(appointment.startsAt)} às{" "}
                  {formatTime(local.minutes)}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {open && data.confirmedCents === 0 ? <CancelOrder orderId={order.id} /> : null}
      </div>

      {order.status === "cancelada" ? (
        <Notice tone="error" className="mb-5">
          Comanda cancelada{order.cancelReason ? `: ${order.cancelReason}` : "."}
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="self-start">
          <PanelSection className="flex items-center justify-between gap-3">
            <h2 className="text-lg">Itens</h2>
            {editable ? (
              <AddItem orderId={order.id} services={services} products={products} staff={staff} />
            ) : null}
          </PanelSection>
          {items.length === 0 ? (
            <PanelSection>
              <p className="text-tinta-suave">Nenhum item ainda. Adicione serviços ou produtos.</p>
            </PanelSection>
          ) : (
            <PanelSection className="p-0 sm:p-0">
              <ul>
                {items.map(({ item, performerName }) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 border-b border-rejunte px-5 py-3 last:border-b-0 sm:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {item.quantity > 1 ? `${item.quantity}× ` : ""}
                        {item.description}
                      </span>
                      {performerName || item.quantity > 1 ? (
                        <span className="block text-sm text-tinta-suave">
                          {item.quantity > 1 ? `${formatBRL(item.unitPriceCents)} cada` : ""}
                          {item.quantity > 1 && performerName ? " · " : ""}
                          {performerName ? `feito por ${performerName}` : ""}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular">{formatBRL(item.totalCents)}</span>
                    {editable ? (
                      <RemoveItem orderId={order.id} itemId={item.id} label={item.description} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </PanelSection>
          )}
          <PanelSection className="flex flex-col gap-2">
            <Row label="Subtotal" value={order.subtotalCents} />
            {order.discountCents > 0 ? <Row label="Desconto" value={-order.discountCents} /> : null}
            <Row label="Total" value={order.totalCents} strong />
          </PanelSection>
          {editable && items.length > 0 ? (
            <PanelSection>
              <DiscountForm orderId={order.id} discountCents={order.discountCents} />
            </PanelSection>
          ) : null}
        </Panel>

        <div className="flex flex-col gap-4">
          {data.payments.length > 0 ? (
            <Panel>
              <PanelSection className="flex flex-col gap-3">
                <h2 className="text-lg">Pagamentos</h2>
                <ul className="flex flex-col gap-2">
                  {data.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 text-[15px]"
                    >
                      <span>
                        {PAYMENT_METHOD_LABELS[payment.method]}
                        {payment.status === "pendente" ? (
                          <span className="mt-1 block">
                            <Badge tone="attention">Aguardando conferência</Badge>
                          </span>
                        ) : null}
                        {payment.receivedCents && payment.receivedCents > payment.amountCents ? (
                          <span className="block text-sm text-tinta-suave">
                            Recebido {formatBRL(payment.receivedCents)}, troco{" "}
                            {formatBRL(payment.receivedCents - payment.amountCents)}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular">{formatBRL(payment.amountCents)}</span>
                        {open ? (
                          <ActionButton
                            action={cancelPaymentAction}
                            hidden={{ paymentId: payment.id }}
                            variant="ghost"
                            size="sm"
                            pendingLabel="…"
                          >
                            Desfazer
                          </ActionButton>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </PanelSection>
            </Panel>
          ) : null}

          {pendingPix.map(({ payment, payload, qr }) => (
            <Panel key={payment.id}>
              <PanelSection className="flex flex-col items-center gap-4 text-center">
                <h2 className="text-lg">PIX de {formatBRL(payment.amountCents)}</h2>
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt={`QR Code PIX de ${formatBRL(payment.amountCents)}`}
                    width={220}
                    height={220}
                    className="rounded-campo border border-rejunte"
                  />
                ) : null}
                <p className="text-[15px] text-tinta-suave">
                  Mostre o QR Code ao tutor. Quando o valor aparecer no app do banco, confirme aqui.
                </p>
                <div className="flex w-full flex-col gap-2">
                  <ActionButton
                    action={confirmPaymentAction}
                    hidden={{ paymentId: payment.id }}
                    size="lg"
                    pendingLabel="Confirmando…"
                  >
                    Recebi o PIX
                  </ActionButton>
                  <div className="flex flex-wrap justify-center gap-2">
                    {payload ? <CopyButton value={payload} label="Copiar código" /> : null}
                    {customer ? (
                      <ActionButton
                        action={sendPixAction}
                        hidden={{ orderId: order.id, amount: String(payment.amountCents / 100) }}
                        variant="secondary"
                        size="sm"
                        pendingLabel="Enviando…"
                      >
                        Enviar pelo WhatsApp
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </PanelSection>
            </Panel>
          ))}

          {open && items.length > 0 && data.remainingCents > 0 ? (
            <Panel>
              <PanelSection className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg">Receber</h2>
                  <p className="text-sm text-tinta-suave">
                    Falta{" "}
                    <span className="text-xl font-[650] text-tinta tabular">
                      {formatBRL(data.remainingCents)}
                    </span>
                  </p>
                </div>
                <PaymentForm
                  key={data.remainingCents}
                  orderId={order.id}
                  remainingCents={data.remainingCents}
                  cashOpen={data.cashOpen}
                  hasPix={hasPix}
                />
              </PanelSection>
            </Panel>
          ) : null}

          {open && items.length > 0 && order.totalCents === 0 ? (
            <Panel>
              <PanelSection className="flex flex-col gap-3">
                <p className="text-[15px]">
                  Total zerado (cortesia ou desconto). Feche a comanda sem pagamento.
                </p>
                <ActionButton
                  action={closeFreeOrderAction}
                  hidden={{ orderId: order.id }}
                  pendingLabel="Fechando…"
                >
                  Fechar comanda
                </ActionButton>
              </PanelSection>
            </Panel>
          ) : null}

          {order.status === "paga" ? (
            <Panel>
              <PanelSection className="flex flex-col gap-3">
                <h2 className="text-lg">Paga</h2>
                <p className="text-[15px] text-tinta-suave">
                  {order.paidAt ? `Em ${formatDateTime(order.paidAt)}. ` : ""}
                  {order.receiptSentAt
                    ? "Recibo enviado pelo WhatsApp."
                    : "Recibo ainda não enviado."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={appUrl(`/recibo/${order.receiptToken}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-campo border border-rejunte-forte bg-white px-3 text-sm font-medium hover:bg-espuma"
                  >
                    <ExternalLink className="size-4" aria-hidden /> Ver recibo
                  </a>
                  {customer ? (
                    <ActionButton
                      action={resendReceiptAction}
                      hidden={{ orderId: order.id }}
                      variant="secondary"
                      size="sm"
                      pendingLabel="Enviando…"
                    >
                      {order.receiptSentAt ? "Reenviar recibo" : "Enviar recibo"}
                    </ActionButton>
                  ) : null}
                </div>
              </PanelSection>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <p
      className={
        strong
          ? "flex justify-between text-xl font-[650]"
          : "flex justify-between text-[15px] text-tinta-suave"
      }
    >
      <span>{label}</span>
      <span className="tabular">{formatBRL(value)}</span>
    </p>
  );
}

function RemoveItem({
  orderId,
  itemId,
  label,
}: {
  orderId: string;
  itemId: string;
  label: string;
}) {
  return (
    <ActionButton
      action={removeOrderItemAction}
      hidden={{ orderId, itemId }}
      variant="ghost"
      size="sm"
      pendingLabel="…"
    >
      <Trash2 className="size-4" aria-hidden />
      <span className="sr-only">Remover {label}</span>
    </ActionButton>
  );
}
