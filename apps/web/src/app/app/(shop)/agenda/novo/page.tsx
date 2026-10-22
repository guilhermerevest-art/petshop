import type { Metadata } from "next";
import Link from "next/link";
import { isLocalDate, todayIn } from "@petshop/core";
import { BookingWizard } from "@/components/agenda/booking-wizard";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { listBookableServices } from "@/lib/agenda";
import { getCustomerListItem } from "@/lib/customers";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NewAppointmentPage(props: PageProps<"/app/agenda/novo">) {
  const ctx = await requireShop({ capability: "agenda.book" });
  const query = await props.searchParams;
  const today = todayIn(ctx.profile.timezone);
  const date =
    typeof query.data === "string" && isLocalDate(query.data) && query.data >= today
      ? query.data
      : today;
  const hour = typeof query.hora === "string" ? Number(query.hora) : NaN;
  const customerId =
    typeof query.cliente === "string" && /^[0-9a-f-]{36}$/i.test(query.cliente)
      ? query.cliente
      : null;
  const [services, customer] = await Promise.all([
    listBookableServices(ctx),
    customerId ? getCustomerListItem(ctx, customerId) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Novo agendamento"
        actions={
          <Link href={`/app/agenda?data=${date}`} className={buttonClasses({ variant: "ghost" })}>
            Voltar para a agenda
          </Link>
        }
      />
      <div className="max-w-3xl">
        <BookingWizard
          services={services}
          sizeRanges={ctx.profile.sizeRanges}
          initialCustomer={customer}
          initialDate={date}
          initialStart={Number.isInteger(hour) && hour >= 0 && hour < 24 * 60 ? hour : null}
          today={today}
          canOverbook={can(ctx.role, "agenda.overbook")}
          canManageCustomers={can(ctx.role, "customers.manage")}
          showPrices={can(ctx.role, "prices.view")}
        />
      </div>
    </>
  );
}
