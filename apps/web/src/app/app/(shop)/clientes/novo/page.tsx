import type { Metadata } from "next";
import { CustomerForm, EMPTY_CUSTOMER } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/ui/panel";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  const ctx = await requireShop({ capability: "customers.manage" });
  return (
    <>
      <PageHeader
        title="Novo cliente"
        description="Tutor e, se quiser, o primeiro pet. O resto dá para completar depois."
      />
      <div className="max-w-3xl">
        <CustomerForm values={EMPTY_CUSTOMER} sizeRanges={ctx.profile.sizeRanges} />
      </div>
    </>
  );
}
