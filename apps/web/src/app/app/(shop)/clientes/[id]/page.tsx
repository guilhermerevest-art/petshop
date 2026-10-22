import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarPlus, MessageCircle, Pencil } from "lucide-react";
import {
  formatBRL,
  formatBrPhone,
  SIZE_LABELS,
  toWhatsAppNumber,
  utcToZoned,
  formatTime,
} from "@petshop/core";
import type { PetStatus } from "@petshop/db/schema";
import { PetDialog } from "@/components/customers/pet-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { getCustomer } from "@/lib/customers";
import { formatShortDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { formatAge, hasAlerts, SPECIES_LABELS } from "@/lib/pets";
import { requireShop } from "@/lib/shop";
import { PET_STATUS_LABELS, statusTone } from "@/lib/status";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerPage(props: PageProps<"/app/clientes/[id]">) {
  const { id } = await props.params;
  const ctx = await requireShop({ capability: "customers.manage" });
  const data = await getCustomer(ctx, id);
  if (!data) notFound();
  const { customer, pets, history } = data;
  const showPrices = can(ctx.role, "prices.view");
  const tz = ctx.profile.timezone;
  const now = new Date();
  const upcoming = history.filter((h) => h.startsAt >= now && !h.canceled).reverse();
  const past = history.filter((h) => h.startsAt < now || h.canceled);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="tabular">{formatBrPhone(customer.phone)}</span>
            <a
              href={`https://wa.me/${toWhatsAppNumber(customer.phone)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-azulejo underline underline-offset-2"
            >
              <MessageCircle className="size-4" aria-hidden /> Abrir conversa
            </a>
          </span>
        }
        actions={
          <>
            <Link
              href={`/app/clientes/${customer.id}/editar`}
              className={buttonClasses({ variant: "secondary" })}
            >
              <Pencil className="size-4" aria-hidden /> Editar
            </Link>
            {pets.length > 0 ? (
              <Link href={`/app/agenda/novo?cliente=${customer.id}`} className={buttonClasses({})}>
                <CalendarPlus className="size-4" aria-hidden /> Agendar
              </Link>
            ) : null}
          </>
        }
      />

      <section aria-labelledby="pets" className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="pets" className="text-xl">
            Pets
          </h2>
          <PetDialog customerId={customer.id} sizeRanges={ctx.profile.sizeRanges} />
        </div>
        {pets.length === 0 ? (
          <p className="rounded-painel border border-dashed border-rejunte-forte p-6 text-tinta-suave">
            Nenhum pet cadastrado. Adicione o pet para poder agendar.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {pets.map((pet) => {
              const age = formatAge(pet.birthDate);
              const facts = [
                SPECIES_LABELS[pet.species],
                pet.breed,
                `${SIZE_LABELS[pet.size]} (${pet.size})`,
                pet.weightKg ? `${String(pet.weightKg).replace(".", ",")} kg` : null,
                age,
              ].filter(Boolean);
              return (
                <li
                  key={pet.id}
                  className="flex flex-col gap-3 rounded-painel border border-rejunte bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-[650]">{pet.name}</p>
                      <p className="text-[15px] text-tinta-suave">{facts.join(", ")}</p>
                    </div>
                    <PetDialog
                      customerId={customer.id}
                      sizeRanges={ctx.profile.sizeRanges}
                      variant="ghost"
                      pet={{
                        id: pet.id,
                        name: pet.name,
                        species: pet.species,
                        breed: pet.breed ?? "",
                        sex: pet.sex ?? "",
                        birthDate: pet.birthDate ?? "",
                        weightKg: pet.weightKg ? String(pet.weightKg).replace(".", ",") : "",
                        size: pet.size,
                        coat: pet.coat ?? "",
                        neutered: pet.neutered === null ? "" : pet.neutered ? "sim" : "nao",
                        color: pet.color ?? "",
                        temperament: pet.temperament ?? "",
                        allergies: pet.allergies ?? "",
                        restrictions: pet.restrictions ?? "",
                        notes: pet.notes ?? "",
                        bathFrequencyDays: pet.bathFrequencyDays
                          ? String(pet.bathFrequencyDays)
                          : "",
                      }}
                    />
                  </div>
                  {hasAlerts(pet) ? (
                    <div className="flex gap-2.5 rounded-campo border border-patinho/60 bg-patinho-claro px-3.5 py-2.5 text-[15px]">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-[#8a5a00]"
                        aria-hidden
                      />
                      <div className="flex flex-col gap-0.5">
                        {pet.temperament ? <span>{pet.temperament}</span> : null}
                        {pet.allergies ? <span>Alergia: {pet.allergies}</span> : null}
                        {pet.restrictions ? <span>{pet.restrictions}</span> : null}
                      </div>
                    </div>
                  ) : null}
                  {pet.notes ? <p className="text-[15px] text-tinta-suave">{pet.notes}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {upcoming.length > 0 ? (
        <History title="Próximos agendamentos" items={upcoming} tz={tz} showPrices={showPrices} />
      ) : null}
      <History
        title="Histórico"
        items={past}
        tz={tz}
        showPrices={showPrices}
        empty="Nenhum atendimento ainda."
      />
    </>
  );
}

function History({
  title,
  items,
  tz,
  showPrices,
  empty,
}: {
  title: string;
  items: Awaited<ReturnType<typeof getCustomer>> extends infer R
    ? R extends { history: infer H }
      ? H
      : never
    : never;
  tz: string;
  showPrices: boolean;
  empty?: string;
}) {
  return (
    <section className="mb-10" aria-label={title}>
      <h2 className="mb-3 text-xl">{title}</h2>
      {items.length === 0 ? (
        <p className="text-tinta-suave">{empty}</p>
      ) : (
        <ul className="overflow-hidden rounded-painel border border-rejunte bg-rejunte">
          {items.map((item) => {
            const local = utcToZoned(item.startsAt, tz);
            return (
              <li key={item.appointmentId} className="[&:not(:first-child)]:mt-px">
                <Link
                  href={`/app/agenda/${item.appointmentId}`}
                  className="flex flex-col gap-2 bg-white px-5 py-4 hover:bg-espuma sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="w-36 shrink-0 font-medium tabular">
                    {formatShortDate(item.startsAt)} {formatTime(local.minutes)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    {item.pets.map((pet, index) => (
                      <span key={index} className="flex flex-wrap items-center gap-2 text-[15px]">
                        <span className="font-medium">{pet.name}</span>
                        <span className="text-tinta-suave">{pet.services.join(", ")}</span>
                        {showPrices ? (
                          <span className="text-tinta-suave tabular">
                            {formatBRL(pet.totalCents)}
                          </span>
                        ) : null}
                        <Badge tone={statusTone(pet.status as PetStatus)}>
                          {PET_STATUS_LABELS[pet.status as PetStatus]}
                        </Badge>
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
