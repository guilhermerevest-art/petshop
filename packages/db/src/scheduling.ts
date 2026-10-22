import { and, eq, gt, lt, notInArray, sql } from "drizzle-orm";
import {
  fitsAt,
  slotsForDay,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
  type Booking,
  type CapacityException,
  type CapacityRule,
  type Slot,
  type Weekday,
} from "@petshop/core";
import {
  appointmentEvents,
  appointmentPets,
  appointments,
  appointmentServices,
  capacityExceptions,
  capacityRules,
} from "./schema";
import type { Transaction } from "./tenancy";

/** Status que não ocupam vaga. */
export const FREE_STATUSES = ["cancelado", "nao_compareceu"] as const;

export interface DayBooking extends Booking {
  appointmentPetId: string;
}

export interface DaySchedule {
  slots: Slot[];
  bookings: DayBooking[];
}

const time = (value: string) => value.slice(0, 5);

/**
 * Trava a agenda do pet shop naquele dia até o fim da transação. Duas reservas para o mesmo dia
 * esperam uma pela outra, então nenhuma estoura a capacidade (RN-05).
 */
export async function lockShopDay(tx: Transaction, organizationId: string, localDate: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`${organizationId}:${localDate}`}))`,
  );
}

/** Horários do dia (com exceções aplicadas) e o que já está ocupado, em minutos locais. */
export async function loadDaySchedule(
  tx: Transaction,
  organizationId: string,
  localDate: string,
  timeZone: string,
): Promise<DaySchedule> {
  const weekday = weekdayOf(localDate);
  const rules = await tx
    .select()
    .from(capacityRules)
    .where(
      and(eq(capacityRules.organizationId, organizationId), eq(capacityRules.weekday, weekday)),
    );
  const exceptions = await tx
    .select()
    .from(capacityExceptions)
    .where(
      and(
        eq(capacityExceptions.organizationId, organizationId),
        eq(capacityExceptions.date, localDate),
      ),
    );
  const slots = slotsForDay(
    rules.map<CapacityRule>((r) => ({
      weekday: r.weekday as Weekday,
      start: time(r.startTime),
      end: time(r.endTime),
      intervalMinutes: r.intervalMinutes,
      slots: r.slots,
    })),
    weekday,
    exceptions.map<CapacityException>((e) => ({
      start: e.startTime ? time(e.startTime) : null,
      end: e.endTime ? time(e.endTime) : null,
      slots: e.slots,
    })),
  );

  const dayStart = zonedToUtc(localDate, 0, timeZone);
  const dayEnd = zonedToUtc(localDate, 24 * 60, timeZone);
  const rows = await tx
    .select({
      id: appointmentPets.id,
      startsAt: appointmentPets.startsAt,
      endsAt: appointmentPets.endsAt,
    })
    .from(appointmentPets)
    .where(
      and(
        eq(appointmentPets.organizationId, organizationId),
        lt(appointmentPets.startsAt, dayEnd),
        gt(appointmentPets.endsAt, dayStart),
        notInArray(appointmentPets.status, [...FREE_STATUSES]),
      ),
    );
  const toMinutes = (date: Date, edge: "start" | "end") => {
    if (date <= dayStart) return 0;
    if (date >= dayEnd) return 24 * 60;
    const local = utcToZoned(date, timeZone);
    return local.minutes === 0 && edge === "end" && local.date !== localDate
      ? 24 * 60
      : local.minutes;
  };
  return {
    slots,
    bookings: rows.map((r) => ({
      appointmentPetId: r.id,
      start: toMinutes(r.startsAt, "start"),
      end: toMinutes(r.endsAt, "end"),
    })),
  };
}

export interface NewAppointmentService {
  serviceId: string | null;
  name: string;
  isAddon: boolean;
  priceCents: number;
  durationMinutes: number;
}

export interface NewAppointmentPet {
  petId: string;
  size: "P" | "M" | "G" | "GG";
  services: NewAppointmentService[];
}

export interface NewAppointment {
  organizationId: string;
  customerId: string;
  localDate: string;
  startMinutes: number;
  timeZone: string;
  pets: NewAppointmentPet[];
  /** Permite passar da capacidade (encaixe). Só para quem tem permissão. */
  allowOverbooking: boolean;
  origin: "balcao" | "portal" | "whatsapp";
  notes: string | null;
  createdBy: string | null;
}

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string; overbooked: boolean }
  | { ok: false; reason: "sem_vaga"; petIndex: number }
  | { ok: false; reason: "sem_servico"; petIndex: number };

/** Cria o agendamento conferindo as vagas de cada pet. Deve rodar dentro de `withTenant`. */
export async function createAppointment(
  tx: Transaction,
  input: NewAppointment,
): Promise<CreateAppointmentResult> {
  await lockShopDay(tx, input.organizationId, input.localDate);
  const { slots, bookings } = await loadDaySchedule(
    tx,
    input.organizationId,
    input.localDate,
    input.timeZone,
  );

  const planned: { pet: NewAppointmentPet; start: number; end: number; overbooked: boolean }[] = [];
  const occupied: Booking[] = [...bookings];
  for (const [index, pet] of input.pets.entries()) {
    const duration = pet.services.reduce((sum, s) => sum + s.durationMinutes, 0);
    if (pet.services.length === 0 || duration <= 0) {
      return { ok: false, reason: "sem_servico", petIndex: index };
    }
    const start = input.startMinutes;
    const fits = fitsAt(slots, occupied, start, duration);
    if (!fits && !input.allowOverbooking) return { ok: false, reason: "sem_vaga", petIndex: index };
    planned.push({ pet, start, end: start + duration, overbooked: !fits });
    occupied.push({ start, end: start + duration });
  }

  const startsAt = zonedToUtc(input.localDate, input.startMinutes, input.timeZone);
  const [appointment] = await tx
    .insert(appointments)
    .values({
      organizationId: input.organizationId,
      customerId: input.customerId,
      startsAt,
      origin: input.origin,
      notes: input.notes,
      createdBy: input.createdBy,
    })
    .returning({ id: appointments.id });
  const appointmentId = appointment!.id;

  for (const item of planned) {
    const [row] = await tx
      .insert(appointmentPets)
      .values({
        organizationId: input.organizationId,
        appointmentId,
        petId: item.pet.petId,
        size: item.pet.size,
        startsAt: zonedToUtc(input.localDate, item.start, input.timeZone),
        endsAt: zonedToUtc(input.localDate, item.end, input.timeZone),
        overbooked: item.overbooked,
      })
      .returning({ id: appointmentPets.id });
    await tx.insert(appointmentServices).values(
      item.pet.services.map((service) => ({
        organizationId: input.organizationId,
        appointmentPetId: row!.id,
        serviceId: service.serviceId,
        name: service.name,
        isAddon: service.isAddon,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
      })),
    );
  }

  const overbooked = planned.some((p) => p.overbooked);
  await tx.insert(appointmentEvents).values({
    organizationId: input.organizationId,
    appointmentId,
    type: "criado",
    toStatus: "agendado",
    actorUserId: input.createdBy,
    data: overbooked ? { encaixe: true } : null,
  });
  return { ok: true, appointmentId, overbooked };
}
