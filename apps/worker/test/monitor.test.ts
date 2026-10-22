import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDb,
  createDb,
  member,
  organization,
  user,
  whatsappInstances,
  withSystem,
  type Database,
} from "@petshop/db";
import { runMigrations } from "@petshop/db/migrate";
import { ConsoleMailer, FakeMessagingProvider } from "@petshop/integrations";
import { monitorWhatsApp } from "../src/monitor";

const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://petshop_app:petshop_app@localhost:5432/petshop_test";
const OWNER_URL =
  process.env.TEST_DATABASE_URL_OWNER ??
  "postgres://petshop_owner:petshop_owner@localhost:5432/petshop_test";

let db: Database;
const orgOk = `mon_ok_${randomUUID()}`;
const orgDown = `mon_down_${randomUUID()}`;
const ownerId = `mon_user_${randomUUID()}`;

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  db = createDb(APP_URL, { max: 2 });
  const now = new Date();
  await db.insert(organization).values([
    { id: orgOk, name: "Conectado", slug: orgOk, createdAt: now },
    { id: orgDown, name: "Caiu", slug: orgDown, createdAt: now },
  ]);
  await db.insert(user).values({
    id: ownerId,
    name: "Dona",
    email: `${ownerId}@exemplo.com.br`,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(member).values({
    id: `m_${ownerId}`,
    organizationId: orgDown,
    userId: ownerId,
    role: "owner",
    createdAt: now,
  });
  await withSystem(db, (tx) =>
    tx.insert(whatsappInstances).values([
      { organizationId: orgOk, instanceName: `ps_${orgOk}`, status: "connected" },
      { organizationId: orgDown, instanceName: `ps_${orgDown}`, status: "connected" },
    ]),
  );
});

afterAll(async () => {
  await db.delete(organization).where(inArray(organization.id, [orgOk, orgDown]));
  await db.delete(user).where(eq(user.id, ownerId));
  await closeDb(db);
});

describe("monitor do WhatsApp", () => {
  it("marca como desconectado o número que caiu e avisa o dono por e-mail", async () => {
    const messaging = new FakeMessagingProvider(0);
    // A instância "ok" está conectada no simulador; a outra nunca conectou (estado "close").
    await messaging.connect(`ps_${orgOk}`);
    const mailer = new ConsoleMailer();

    const result = await monitorWhatsApp(db, messaging, mailer, "https://app.exemplo.com.br");

    expect(result.disconnected).toContain(orgDown);
    expect(result.disconnected).not.toContain(orgOk);
    const rows = await withSystem(db, (tx) =>
      tx
        .select()
        .from(whatsappInstances)
        .where(inArray(whatsappInstances.organizationId, [orgOk, orgDown])),
    );
    expect(rows.find((r) => r.organizationId === orgDown)?.status).toBe("disconnected");
    expect(rows.find((r) => r.organizationId === orgOk)?.status).toBe("connected");
    expect(
      mailer.sent.some((m) => m.to === `${ownerId}@exemplo.com.br` && m.subject.includes("Caiu")),
    ).toBe(true);
    expect(mailer.sent.find((m) => m.subject.includes("Caiu"))?.text).toContain(
      "https://app.exemplo.com.br/app/configuracoes/whatsapp",
    );
  });
});
