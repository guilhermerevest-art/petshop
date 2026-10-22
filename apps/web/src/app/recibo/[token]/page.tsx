import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatBRL, formatDocument } from "@petshop/core";
import { PrintButton } from "@/components/sales/print-button";
import { formatDateTime } from "@/lib/format";
import { getReceipt, PAYMENT_METHOD_LABELS } from "@/lib/sales";

export const metadata: Metadata = { title: "Recibo", robots: { index: false, follow: false } };

/** Recibo público da comanda paga. O link (com código aleatório) vai para o tutor pelo WhatsApp. */
export default async function ReceiptPage(props: PageProps<"/recibo/[token]">) {
  const { token } = await props.params;
  const data = await getReceipt(token);
  if (!data) notFound();
  const { order, items, payments, customer, profile, shopName } = data;
  const address = [
    [profile.addressStreet, profile.addressNumber].filter(Boolean).join(", "),
    profile.addressDistrict,
    [profile.addressCity, profile.addressState].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="min-h-dvh bg-espuma px-4 py-8 print:bg-white print:p-0">
      <article className="mx-auto max-w-md rounded-painel border border-rejunte bg-white p-6 print:border-0">
        <header className="border-b border-dashed border-rejunte-forte pb-4 text-center">
          <h1 className="text-xl font-[650]">{profile.legalName || shopName}</h1>
          {profile.document ? (
            <p className="text-sm text-tinta-suave">{formatDocument(profile.document)}</p>
          ) : null}
          {address ? <p className="text-sm text-tinta-suave">{address}</p> : null}
        </header>
        <section className="border-b border-dashed border-rejunte-forte py-4 text-[15px]">
          <p className="font-medium">Recibo da comanda {order.number}</p>
          <p className="text-tinta-suave">{order.paidAt ? formatDateTime(order.paidAt) : ""}</p>
          {customer ? <p className="text-tinta-suave">Cliente: {customer.name}</p> : null}
        </section>
        <ul className="flex flex-col gap-1.5 border-b border-dashed border-rejunte-forte py-4 text-[15px]">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span>
                {item.quantity > 1 ? `${item.quantity}× ` : ""}
                {item.description}
              </span>
              <span className="tabular">{formatBRL(item.totalCents)}</span>
            </li>
          ))}
        </ul>
        <section className="flex flex-col gap-1 border-b border-dashed border-rejunte-forte py-4 text-[15px]">
          {order.discountCents > 0 ? (
            <>
              <p className="flex justify-between text-tinta-suave">
                <span>Subtotal</span>
                <span className="tabular">{formatBRL(order.subtotalCents)}</span>
              </p>
              <p className="flex justify-between text-tinta-suave">
                <span>Desconto</span>
                <span className="tabular">-{formatBRL(order.discountCents)}</span>
              </p>
            </>
          ) : null}
          <p className="flex justify-between text-lg font-[650]">
            <span>Total pago</span>
            <span className="tabular">{formatBRL(order.totalCents)}</span>
          </p>
          {payments.map((payment) => (
            <p key={payment.id} className="flex justify-between text-tinta-suave">
              <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
              <span className="tabular">{formatBRL(payment.amountCents)}</span>
            </p>
          ))}
        </section>
        <footer className="pt-4 text-center text-sm text-tinta-suave">
          <p>Obrigado pela preferência! 🐾</p>
          <p className="mt-1">Este recibo não substitui a nota fiscal.</p>
          <div className="mt-4 print:hidden">
            <PrintButton />
          </div>
        </footer>
      </article>
    </main>
  );
}
