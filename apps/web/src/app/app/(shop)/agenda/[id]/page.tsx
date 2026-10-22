import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, MessageCircle } from "lucide-react";
import {
  formatBRL,
  formatBrPhone,
  formatLocalDate,
  formatTime,
  SIZE_LABELS,
  toWhatsAppNumber,
  utcToZoned,
} from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { CancelAppointment } from "@/components/agenda/cancel-appointment";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelSection } from "@/components/ui/panel";
import { getAppointment } from "@/lib/agenda";
import { orderOfAppointment } from "@/lib/sales";
import { capitalize, formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { hasAlerts } from "@/lib/pets";
import { requireShop } from "@/lib/shop";
import { NEXT_STATUS, PET_STATUS_LABELS, statusTone } from "@/lib/status";
import { confirmAppointmentAction, updatePetStatusAction } from "@/server/agenda-actions";
import { openAppointmentOrderAction } from "@/server/sales-actions";

export const metadata: Metadata = { title: "Agendamento" };

const EVENT_LABELS: Record<string, string> = {
  criado: "Agendamento criado",
  cancelado: "Agendamento cancelado",
  confirmado_pelo_tutor: "Tutor confirmou presença",
};

export default async function AppointmentPage(props: PageProps<"/app/agenda/[id]">) {
  const { id } = await props.params;
  const ctx = await requireShop({ capability: "agenda.operate" });
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getAppointment(ctx, id);
  if (!data) notFound();
  const { appointment, customer, pets, events } = data;
  const tz = ctx.profile.timezone;
  const local = utcToZoned(appointment.startsAt, tz);
  const canBook = can(ctx.role, "agenda.book");
  const showPrices = can(ctx.role, "prices.view");
  const canceled = Boolean(appointment.canceledAt);
  const active =
    !canceled &&
    pets.some((p) => !["concluido", "nao_compareceu", "cancelado"].includes(p.entry.status));
  const total = pets.reduce((sum, p) => sum + p.services.reduce((s, x) => s + x.priceCents, 0), 0);
  const canSell = can(ctx.role, "sales.manage");
  const order = canSell ? await orderOfAppointment(ctx, appointment.id) : undefined;
  const chargeable =
    !canceled &&
    pets.some((p) =>
      ["check_in", "em_atendimento", "pronto", "concluido"].includes(p.entry.status),
    );
  const petName = (appointmentPetId: string | null) =>
    pets.find((p) => p.entry.id === appointmentPetId)?.pet.name ?? null;

  return (
    <>
      <Link
        href={`/app/agenda?data=${local.date}`}
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-tinta-suave hover:text-tinta"
      >
        <ChevronLeft className="size-4" aria-hidden /> Agenda do dia
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] sm:text-[32px]">{pets.map((p) => p.pet.name).join(" e ")}</h1>
          <p className="mt-1 text-tinta-suave">
            {capitalize(formatLocalDate(local.date))}, às {formatTime(local.minutes)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canceled ? <Badge tone="danger">Cancelado</Badge> : null}
          {!canceled && appointment.confirmedAt ? (
            <Badge tone="ok">Presença confirmada</Badge>
          ) : null}
        </div>
      </div>

      {canceled && appointment.cancelReason ? (
        <p className="mb-5 text-tinta-suave">Motivo do cancelamento: {appointment.cancelReason}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          {pets.map(({ entry, pet, services }) => {
            const next = canceled ? undefined : NEXT_STATUS[entry.status];
            const start = utcToZoned(entry.startsAt, tz).minutes;
            const end = utcToZoned(entry.endsAt, tz).minutes;
            return (
              <Panel key={entry.id}>
                <PanelSection className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-[650]">
                        {pet.name}{" "}
                        <span className="text-[15px] font-normal text-tinta-suave">
                          {SIZE_LABELS[entry.size]} ({entry.size})
                        </span>
                      </p>
                      <p className="text-[15px] text-tinta-suave tabular">
                        {formatTime(start)} às {formatTime(end)}
                        {entry.overbooked ? " · encaixe" : ""}
                      </p>
                    </div>
                    <Badge tone={statusTone(entry.status)}>{PET_STATUS_LABELS[entry.status]}</Badge>
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
                  <ul className="flex flex-col gap-1 text-[15px]">
                    {services.map((service) => (
                      <li key={service.id} className="flex justify-between gap-4">
                        <span>
                          {service.isAddon ? "+ " : ""}
                          {service.name}
                        </span>
                        {showPrices ? (
                          <span className="text-tinta-suave tabular">
                            {formatBRL(service.priceCents)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {next || (!canceled && entry.status === "agendado") ? (
                    <div className="flex flex-wrap gap-2 border-t border-rejunte pt-4">
                      {next ? (
                        <ActionButton
                          action={updatePetStatusAction}
                          hidden={{ appointmentPetId: entry.id, to: next.to }}
                          pendingLabel="Salvando…"
                        >
                          {next.label}
                        </ActionButton>
                      ) : null}
                      {entry.status === "agendado" ? (
                        <ActionButton
                          action={updatePetStatusAction}
                          hidden={{ appointmentPetId: entry.id, to: "nao_compareceu" }}
                          variant="ghost"
                          pendingLabel="Salvando…"
                        >
                          Não veio
                        </ActionButton>
                      ) : null}
                    </div>
                  ) : null}
                </PanelSection>
              </Panel>
            );
          })}
          {appointment.notes ? (
            <Panel>
              <PanelSection>
                <h2 className="mb-1 text-[15px] font-medium text-tinta-suave">Observações</h2>
                <p>{appointment.notes}</p>
              </PanelSection>
            </Panel>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Panel>
            <PanelSection className="flex flex-col gap-3">
              <h2 className="text-[15px] font-medium text-tinta-suave">Tutor</h2>
              <div>
                {can(ctx.role, "customers.manage") ? (
                  <Link
                    href={`/app/clientes/${customer.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {customer.name}
                  </Link>
                ) : (
                  <p className="font-medium">{customer.name}</p>
                )}
                <p className="text-[15px] text-tinta-suave tabular">
                  {formatBrPhone(customer.phone)}
                </p>
              </div>
              <a
                href={`https://wa.me/${toWhatsAppNumber(customer.phone)}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({
                  variant: "secondary",
                  size: "sm",
                  className: "self-start",
                })}
              >
                <MessageCircle className="size-4" aria-hidden /> Abrir conversa
              </a>
            </PanelSection>
            {showPrices ? (
              <PanelSection className="flex justify-between font-medium">
                <span>Total</span>
                <span className="tabular">{formatBRL(total)}</span>
              </PanelSection>
            ) : null}
            {canSell && (order || chargeable) ? (
              <PanelSection className="flex flex-col gap-2">
                {order ? (
                  <Link
                    href={`/app/comandas/${order.id}`}
                    className={buttonClasses({
                      variant: order.status === "paga" ? "secondary" : "primary",
                    })}
                  >
                    {order.status === "paga"
                      ? `Comanda ${order.number} paga`
                      : `Abrir comanda ${order.number}`}
                  </Link>
                ) : (
                  <ActionButton
                    action={openAppointmentOrderAction}
                    hidden={{ appointmentId: appointment.id }}
                    pendingLabel="Abrindo…"
                  >
                    Cobrar
                  </ActionButton>
                )}
              </PanelSection>
            ) : null}
            {canBook && active ? (
              <PanelSection className="flex flex-col gap-2">
                {!appointment.confirmedAt && pets.some((p) => p.entry.status === "agendado") ? (
                  <ActionButton
                    action={confirmAppointmentAction}
                    hidden={{ appointmentId: appointment.id }}
                    variant="secondary"
                    pendingLabel="Salvando…"
                  >
                    Tutor confirmou presença
                  </ActionButton>
                ) : null}
                <CancelAppointment appointmentId={appointment.id} />
              </PanelSection>
            ) : null}
          </Panel>

          <section aria-labelledby="historico">
            <h2 id="historico" className="mb-2 text-[15px] font-medium text-tinta-suave">
              Histórico
            </h2>
            <ol className="flex flex-col gap-2 border-l-2 border-rejunte pl-4 text-[15px]">
              {events.map((event) => (
                <li key={event.id}>
                  <p>
                    {event.type === "status" && event.toStatus
                      ? `${petName(event.appointmentPetId) ?? "Pet"}: ${PET_STATUS_LABELS[event.toStatus as keyof typeof PET_STATUS_LABELS]}`
                      : (EVENT_LABELS[event.type] ?? event.type)}
                  </p>
                  <p className="text-sm text-tinta-suave">
                    {formatDateTime(event.createdAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
