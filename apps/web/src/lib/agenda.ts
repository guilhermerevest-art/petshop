import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { fitsAt, utcToZoned, zonedToUtc, type Booking, type Slot } from "@petshop/core";
import {
  appointmentEvents,
  appointmentPets,
  appointments,
  appointmentServices,
  customers,
  pets,
  servicePrices,
  services,
  user,
  type PetStatus,
} from "@petshop/db";
import { FREE_STATUSES, loadDaySchedule } from "@petshop/db/scheduling";
import { inShop, type ShopContext } from "./shop";

export interface BoardEntry {
  appointmentPetId: string;
  appointmentId: string;
  petName: string;
  petSize: string;
  hasAlerts: boolean;
  customerName: string;
  services: string[];
  status: PetStatus;
  overbooked: boolean;
  /** minutos locais */
  start: number;
  end: number;
  lane: number;
}

export interface BoardRow {
  slot: Slot;
  /** Uma posição por vaga (e mais, se houver encaixe). `null` = vaga livre; `undefined` = fora da capacidade. */
  cells: (BoardEntry | null | undefined)[];
}

export interface DayBoard {
  open: boolean;
  rows: BoardRow[];
  lanes: number;
  capacityTotal: number;
  occupiedTotal: number;
  entries: BoardEntry[];
  /** Cancelados e faltas do dia (fora do quadro). */
  inactive: BoardEntry[];
}

/** Quadro do dia: cada pet ganha uma coluna fixa enquanto dura o atendimento. */
export async function getDayBoard(ctx: ShopContext, localDate: string): Promise<DayBoard> {
  const orgId = ctx.organization.id;
  const tz = ctx.profile.timezone;
  return inShop(ctx, async (tx) => {
    const { slots } = await loadDaySchedule(tx, orgId, localDate, tz);
    const dayStart = zonedToUtc(localDate, 0, tz);
    const dayEnd = zonedToUtc(localDate, 24 * 60, tz);
    const rows = await tx
      .select({
        appointmentPetId: appointmentPets.id,
        appointmentId: appointmentPets.appointmentId,
        startsAt: appointmentPets.startsAt,
        endsAt: appointmentPets.endsAt,
        status: appointmentPets.status,
        overbooked: appointmentPets.overbooked,
        petName: pets.name,
        petSize: appointmentPets.size,
        temperament: pets.temperament,
        allergies: pets.allergies,
        restrictions: pets.restrictions,
        customerName: customers.name,
      })
      .from(appointmentPets)
      .innerJoin(pets, eq(pets.id, appointmentPets.petId))
      .innerJoin(appointments, eq(appointments.id, appointmentPets.appointmentId))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(
        and(
          eq(appointmentPets.organizationId, orgId),
          lt(appointmentPets.startsAt, dayEnd),
          gt(appointmentPets.endsAt, dayStart),
        ),
      )
      .orderBy(asc(appointmentPets.startsAt), asc(appointmentPets.createdAt));
    const serviceRows = rows.length
      ? await tx
          .select({
            appointmentPetId: appointmentServices.appointmentPetId,
            name: appointmentServices.name,
          })
          .from(appointmentServices)
          .where(
            inArray(
              appointmentServices.appointmentPetId,
              rows.map((r) => r.appointmentPetId),
            ),
          )
          .orderBy(asc(appointmentServices.isAddon), asc(appointmentServices.createdAt))
      : [];

    const toEntry = (r: (typeof rows)[number]): BoardEntry => ({
      appointmentPetId: r.appointmentPetId,
      appointmentId: r.appointmentId,
      petName: r.petName,
      petSize: r.petSize,
      hasAlerts: Boolean(r.temperament || r.allergies || r.restrictions),
      customerName: r.customerName,
      services: serviceRows
        .filter((s) => s.appointmentPetId === r.appointmentPetId)
        .map((s) => s.name),
      status: r.status,
      overbooked: r.overbooked,
      start: r.startsAt <= dayStart ? 0 : utcToZoned(r.startsAt, tz).minutes,
      end: r.endsAt >= dayEnd ? 24 * 60 : utcToZoned(r.endsAt, tz).minutes,
      lane: 0,
    });
    const active = rows
      .filter((r) => !(FREE_STATUSES as readonly string[]).includes(r.status))
      .map(toEntry);
    const inactive = rows
      .filter((r) => (FREE_STATUSES as readonly string[]).includes(r.status))
      .map(toEntry);

    // Distribui os pets em colunas: cada um fica na primeira coluna livre no seu início.
    const laneEnds: number[] = [];
    for (const entry of active) {
      let lane = laneEnds.findIndex((end) => end <= entry.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = entry.end;
      entry.lane = lane;
    }
    const maxCapacity = slots.reduce((max, s) => Math.max(max, s.capacity), 0);
    const lanes = Math.max(maxCapacity, laneEnds.length);

    const boardRows: BoardRow[] = slots.map((slot) => {
      const cells: (BoardEntry | null | undefined)[] = Array.from({ length: lanes }, (_, i) =>
        i < slot.capacity ? null : undefined,
      );
      for (const entry of active) {
        if (entry.start < slot.end && entry.end > slot.start) cells[entry.lane] = entry;
      }
      return { slot, cells };
    });

    const capacityTotal = slots.reduce((sum, s) => sum + s.capacity, 0);
    const occupiedTotal = boardRows.reduce(
      (sum, row) => sum + row.cells.filter((c) => c && c !== null).length,
      0,
    );
    return {
      open: slots.length > 0,
      rows: boardRows,
      lanes,
      capacityTotal,
      occupiedTotal,
      entries: active,
      inactive,
    };
  });
}

export interface AvailableTimes {
  open: boolean;
  /** Horários em que todos os pets cabem juntos. */
  starts: number[];
  /** Todos os horários do dia (para encaixe). */
  all: number[];
}

/** Horários de início em que todos os pets (com as durações informadas) cabem ao mesmo tempo. */
export async function getAvailableTimes(
  ctx: ShopContext,
  localDate: string,
  durations: number[],
): Promise<AvailableTimes> {
  const orgId = ctx.organization.id;
  const tz = ctx.profile.timezone;
  const { slots, bookings } = await inShop(ctx, (tx) => loadDaySchedule(tx, orgId, localDate, tz));
  const all = slots.map((s) => s.start);
  const now = utcToZoned(new Date(), tz);
  const notPast = (start: number) =>
    localDate > now.date || (localDate === now.date && start >= now.minutes - 15);
  const starts = all.filter((start) => {
    if (!notPast(start)) return false;
    const occupied: Booking[] = [...bookings];
    for (const duration of durations) {
      if (!fitsAt(slots, occupied, start, duration)) return false;
      occupied.push({ start, end: start + duration });
    }
    return true;
  });
  return { open: slots.length > 0, starts, all: all.filter(notPast) };
}

export async function getAppointment(ctx: ShopContext, id: string) {
  const orgId = ctx.organization.id;
  return inShop(ctx, async (tx) => {
    const appointment = await tx.query.appointments.findFirst({
      where: and(eq(appointments.id, id), eq(appointments.organizationId, orgId)),
    });
    if (!appointment) return null;
    const customer = await tx.query.customers.findFirst({
      where: eq(customers.id, appointment.customerId),
    });
    const petRows = await tx
      .select({ entry: appointmentPets, pet: pets })
      .from(appointmentPets)
      .innerJoin(pets, eq(pets.id, appointmentPets.petId))
      .where(eq(appointmentPets.appointmentId, id))
      .orderBy(asc(appointmentPets.createdAt));
    const serviceRows = petRows.length
      ? await tx
          .select()
          .from(appointmentServices)
          .where(
            inArray(
              appointmentServices.appointmentPetId,
              petRows.map((p) => p.entry.id),
            ),
          )
          .orderBy(asc(appointmentServices.isAddon), asc(appointmentServices.createdAt))
      : [];
    const events = await tx
      .select({
        id: appointmentEvents.id,
        type: appointmentEvents.type,
        toStatus: appointmentEvents.toStatus,
        appointmentPetId: appointmentEvents.appointmentPetId,
        createdAt: appointmentEvents.createdAt,
        actorName: user.name,
        data: appointmentEvents.data,
      })
      .from(appointmentEvents)
      .leftJoin(user, eq(user.id, appointmentEvents.actorUserId))
      .where(eq(appointmentEvents.appointmentId, id))
      .orderBy(asc(appointmentEvents.createdAt));
    return {
      appointment,
      customer: customer!,
      pets: petRows.map(({ entry, pet }) => ({
        entry,
        pet,
        services: serviceRows.filter((s) => s.appointmentPetId === entry.id),
      })),
      events,
    };
  });
}

export interface BookableService {
  id: string;
  name: string;
  isAddon: boolean;
  /** Preço e duração por porte; portes sem preço não aparecem. */
  prices: Partial<Record<"P" | "M" | "G" | "GG", { priceCents: number; durationMinutes: number }>>;
}

/** Serviços ativos com preço e duração por porte, na ordem definida pelo pet shop. */
export async function listBookableServices(ctx: ShopContext): Promise<BookableService[]> {
  const orgId = ctx.organization.id;
  return inShop(ctx, async (tx) => {
    const rows = await tx
      .select({ service: services, price: servicePrices })
      .from(services)
      .leftJoin(servicePrices, eq(servicePrices.serviceId, services.id))
      .where(
        and(
          eq(services.organizationId, orgId),
          eq(services.active, true),
          isNull(services.deletedAt),
        ),
      )
      .orderBy(asc(services.isAddon), asc(services.position), asc(services.name));
    const list: BookableService[] = [];
    for (const { service, price } of rows) {
      let item = list.find((s) => s.id === service.id);
      if (!item) {
        item = { id: service.id, name: service.name, isAddon: service.isAddon, prices: {} };
        list.push(item);
      }
      if (price)
        item.prices[price.size] = {
          priceCents: price.priceCents,
          durationMinutes: price.durationMinutes,
        };
    }
    return list;
  });
}
