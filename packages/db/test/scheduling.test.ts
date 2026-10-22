import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb, type Database } from "../src/client";
import { runMigrations } from "../src/migrate";
import { appointmentPets, capacityRules, customers, organization, pets } from "../src/schema";
import { createAppointment, loadDaySchedule, type NewAppointment } from "../src/scheduling";
import { withTenant } from "../src/tenancy";

const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://petshop_app:petshop_app@localhost:5432/petshop_test";
const OWNER_URL =
  process.env.TEST_DATABASE_URL_OWNER ??
  "postgres://petshop_owner:petshop_owner@localhost:5432/petshop_test";

const TZ = "America/Sao_Paulo";
const DATE = "2026-10-22"; // quinta-feira
let db: Database;
const org = `sched_${randomUUID()}`;
let customerId: string;
const petIds: string[] = [];

const service = (minutes: number) => ({
  serviceId: null,
  name: "Banho",
  isAddon: false,
  priceCents: 5000,
  durationMinutes: minutes,
});

function input(
  petId: string,
  startMinutes: number,
  minutes = 60,
  allowOverbooking = false,
): NewAppointment {
  return {
    organizationId: org,
    customerId,
    localDate: DATE,
    startMinutes,
    timeZone: TZ,
    pets: [{ petId, size: "P", services: [service(minutes)] }],
    allowOverbooking,
    origin: "balcao",
    notes: null,
    createdBy: null,
  };
}

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  db = createDb(APP_URL, { max: 8 });
  await db
    .insert(organization)
    .values({ id: org, name: "Agenda", slug: org, createdAt: new Date() });
  await withTenant(db, org, async (tx) => {
    // Quinta, 8h às 12h, 1 vaga por hora
    await tx.insert(capacityRules).values({
      organizationId: org,
      weekday: 4,
      startTime: "08:00",
      endTime: "12:00",
      intervalMinutes: 60,
      slots: 1,
    });
    const [c] = await tx
      .insert(customers)
      .values({ organizationId: org, name: "Tutor", phone: "+5519987654321" })
      .returning();
    customerId = c!.id;
    for (let i = 0; i < 6; i++) {
      const [p] = await tx
        .insert(pets)
        .values({ organizationId: org, customerId, name: `Pet ${i}`, size: "P" })
        .returning();
      petIds.push(p!.id);
    }
  });
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, org));
  await closeDb(db);
});

describe("agendamento com vagas", () => {
  it("cinco pedidos simultâneos para a última vaga: só um consegue", async () => {
    const results = await Promise.all(
      petIds
        .slice(0, 5)
        .map((petId) => withTenant(db, org, (tx) => createAppointment(tx, input(petId, 8 * 60)))),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "sem_vaga")).toHaveLength(4);
  });

  it("serviço de 2h ocupa a vaga dos dois horários", async () => {
    const twoHours = await withTenant(db, org, (tx) =>
      createAppointment(tx, input(petIds[0]!, 9 * 60, 120)),
    );
    expect(twoHours.ok).toBe(true);
    const at10 = await withTenant(db, org, (tx) =>
      createAppointment(tx, input(petIds[1]!, 10 * 60)),
    );
    expect(at10).toMatchObject({ ok: false, reason: "sem_vaga" });
    const schedule = await withTenant(db, org, (tx) => loadDaySchedule(tx, org, DATE, TZ));
    expect(schedule.bookings.map((b) => [b.start, b.end]).sort()).toEqual([
      [480, 540],
      [540, 660],
    ]);
  });

  it("não passa do fechamento", async () => {
    const late = await withTenant(db, org, (tx) =>
      createAppointment(tx, input(petIds[2]!, 11 * 60, 120)),
    );
    expect(late).toMatchObject({ ok: false, reason: "sem_vaga" });
  });

  it("encaixe com permissão passa da capacidade e fica marcado", async () => {
    const forced = await withTenant(db, org, (tx) =>
      createAppointment(tx, input(petIds[3]!, 10 * 60, 60, true)),
    );
    expect(forced).toMatchObject({ ok: true, overbooked: true });
  });

  it("cancelado libera a vaga", async () => {
    const free = await withTenant(db, org, (tx) =>
      createAppointment(tx, input(petIds[4]!, 11 * 60)),
    );
    expect(free.ok).toBe(true);
    const id = (free as { appointmentId: string }).appointmentId;
    await withTenant(db, org, (tx) =>
      tx
        .update(appointmentPets)
        .set({ status: "cancelado" })
        .where(eq(appointmentPets.appointmentId, id)),
    );
    const again = await withTenant(db, org, (tx) =>
      createAppointment(tx, input(petIds[5]!, 11 * 60)),
    );
    expect(again.ok).toBe(true);
  });
});
