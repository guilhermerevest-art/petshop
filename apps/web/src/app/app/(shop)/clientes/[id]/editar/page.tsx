import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatBrPhone, formatCpf } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/ui/panel";
import { getCustomer } from "@/lib/customers";
import { requireShop } from "@/lib/shop";
import { archiveCustomerAction } from "@/server/customer-actions";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage(props: PageProps<"/app/clientes/[id]/editar">) {
  const { id } = await props.params;
  const ctx = await requireShop({ capability: "customers.manage" });
  const data = await getCustomer(ctx, id);
  if (!data) notFound();
  const c = data.customer;
  return (
    <>
      <PageHeader title={`Editar ${c.name}`} />
      <div className="flex max-w-3xl flex-col gap-8">
        <CustomerForm
          sizeRanges={ctx.profile.sizeRanges}
          values={{
            id: c.id,
            name: c.name,
            phone: formatBrPhone(c.phone),
            email: c.email ?? "",
            document: c.document ? formatCpf(c.document) : "",
            origin: c.origin ?? "",
            notes: c.notes ?? "",
            marketingOptIn: c.marketingOptIn,
          }}
        />
        <details className="rounded-painel border border-rejunte bg-white px-5 py-4">
          <summary className="cursor-pointer text-[15px] text-tinta-suave hover:text-alerta">
            Remover cliente
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-[15px] text-tinta-suave">
              O cliente e os pets saem das listas. O histórico de atendimentos e vendas continua
              guardado.
            </p>
            <div>
              <ActionButton
                action={archiveCustomerAction}
                hidden={{ id: c.id }}
                variant="danger"
                pendingLabel="Removendo…"
              >
                Remover {c.name}
              </ActionButton>
            </div>
          </div>
        </details>
      </div>
    </>
  );
}
