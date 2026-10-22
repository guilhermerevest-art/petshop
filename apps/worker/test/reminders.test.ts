import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { zonedToUtc } from "@petshop/core";
import {
  appointmentPets,
  appointments,
  closeDb,
  createDb,
  customers,
  organization,
  pets,
  shopProfiles,
  whatsappInstances,
  withSystem,
  withTenant,
  type Database,
} from "@petshop/db";
import { runMigrations } from "@petshop/db/migrate";
import { FakeMessagingProvider } from "@petshop/integrations";
import { sendReminders } from "../src/reminders";

const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://petshop_app:petshop_app@localhost:5432/petshop_test";
const OWNER_URL =
  process.env.TEST_DATABASE_URL_OWNER ??
  "postgres://petshop_owner:petshop_owner@localhost:5432/petshop_test";

const TZ = "America/Sao_Paulo";
let db: Database;
const orgId = `lem_${randomUUID()}`;
const ids: { active?: string; canceled?: string } = {};

async function book(
  customerId: string,
  petId: string,
  localDate: string,
  minutes: number,
  canceled = false,
) {
  return withTenant(db, orgId, async (tx) => {
    const startsAt = zonedToUtc(localDate, minutes, TZ);
    const [appointment] = await tx
      .insert(appointments)
      .values({
        organizationId: orgId,
        customerId,
        startsAt,
        canceledAt: canceled ? new Date() : null,
      })
      .returning({ id: appointments.id });
    await tx.insert(appointmentPets).values({
      organizationId: orgId,
      appointmentId: appointment!.id,
      petId,
      size: "P",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60_000),
      status: canceled ? "cancelado" : "agendado",
    });
    return appointment!.id;
  });
}

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  db = createDb(APP_URL, { max: 2 });
  await db
    .insert(organization)
    .values({ id: orgId, name: "Banho Bom", slug: orgId, createdAt: new Date() });
  await withSystem(db, async (tx) => {
    await tx.insert(shopProfiles).values({ organizationId: orgId, timezone: TZ });
    await tx
      .insert(whatsappInstances)
      .values({ organizationId: orgId, instanceName: `ps_${orgId}`, status: "connected" });
  });
  const { customerId, petId } = await withTenant(db, orgId, async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ organizationId: orgId, name: "Carla Mendes", phone: "+5519991112233" })
      .returning({ id: customers.id });
    const [pet] = await tx
      .insert(pets)
      .values({ organizationId: orgId, customerId: customer!.id, name: "Thor", size: "P" })
      .returning({ id: pets.id });
    return { customerId: customer!.id, petId: pet!.id };
  });
  ids.active = await book(customerId, petId, "2026-03-11", 9 * 60);
  ids.canceled = await book(customerId, petId, "2026-03-11", 14 * 60, true);
  // Depois de amanhã: ainda não é hora do lembrete.
  await book(customerId, petId, "2026-03-12", 9 * 60);
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, orgId));
  await closeDb(db);
});

describe("lembretes da véspera", () => {
  it("só envia a partir das 18h, uma vez por agendamento, e ignora cancelados", async () => {
    const messaging = new FakeMessagingProvider(0);
    await messaging.connect(`ps_${orgId}`);
    const mine = () => messaging.sent.filter((m) => m.instanceName === `ps_${orgId}`);

    const early = await sendReminders(db, messaging, zonedToUtc("2026-03-10", 17 * 60 + 50, TZ));
    expect(mine()).toHaveLength(0);
    expect(early.sent).toBe(0);

    await sendReminders(db, messaging, zonedToUtc("2026-03-10", 18 * 60 + 5, TZ));
    expect(mine()).toHaveLength(1);
    expect(mine()[0]!.to).toBe("5519991112233");
    expect(mine()[0]!.text).toContain("amanhã às 09:00 tem Thor");

    // Rodar de novo não repete.
    await sendReminders(db, messaging, zonedToUtc("2026-03-10", 18 * 60 + 20, TZ));
    expect(mine()).toHaveLength(1);

    const rows = await withTenant(db, orgId, (tx) => tx.select().from(appointments));
    expect(rows.find((r) => r.id === ids.active)?.reminderSentAt).not.toBeNull();
    expect(rows.find((r) => r.id === ids.canceled)?.reminderSentAt).toBeNull();
  });
});
