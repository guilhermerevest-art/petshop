import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb, type Database } from "../src/client";
import { runMigrations } from "../src/migrate";
import { organization, services, shopProfiles } from "../src/schema";
import { withSystem, withTenant } from "../src/tenancy";
import { checkDatabaseRole } from "../src/safety";

const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://petshop_app:petshop_app@localhost:5432/petshop_test";
const OWNER_URL =
  process.env.TEST_DATABASE_URL_OWNER ??
  "postgres://petshop_owner:petshop_owner@localhost:5432/petshop_test";

let db: Database;
const orgA = `test_a_${randomUUID()}`;
const orgB = `test_b_${randomUUID()}`;

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  db = createDb(APP_URL, { max: 2 });
  await db.insert(organization).values([
    { id: orgA, name: "Pet Shop A", slug: orgA, createdAt: new Date() },
    { id: orgB, name: "Pet Shop B", slug: orgB, createdAt: new Date() },
  ]);
  await withTenant(db, orgA, (tx) =>
    tx.insert(services).values({ organizationId: orgA, name: "Banho A", category: "banho" }),
  );
  await withTenant(db, orgB, (tx) =>
    tx.insert(services).values({ organizationId: orgB, name: "Banho B", category: "banho" }),
  );
});

afterAll(async () => {
  await db.delete(organization).where(inArray(organization.id, [orgA, orgB]));
  await closeDb(db);
});

describe("isolamento entre pet shops (RLS)", () => {
  it("sem pet shop definido, o banco não devolve nenhuma linha", async () => {
    const rows = await db.select().from(services);
    expect(rows).toHaveLength(0);
  });

  it("cada pet shop só vê os próprios dados, mesmo sem filtro na consulta", async () => {
    const rowsA = await withTenant(db, orgA, (tx) => tx.select().from(services));
    expect(rowsA.map((r) => r.name)).toEqual(["Banho A"]);
    const rowsB = await withTenant(db, orgB, (tx) => tx.select().from(services));
    expect(rowsB.map((r) => r.name)).toEqual(["Banho B"]);
  });

  it("um pet shop não consegue gravar dados em nome de outro", async () => {
    await expect(
      withTenant(db, orgA, (tx) =>
        tx.insert(services).values({ organizationId: orgB, name: "Invasão", category: "banho" }),
      ),
    ).rejects.toThrow();
  });

  it("um pet shop não consegue alterar nem apagar dados de outro", async () => {
    const updated = await withTenant(db, orgA, (tx) =>
      tx
        .update(services)
        .set({ name: "Alterado" })
        .where(eq(services.organizationId, orgB))
        .returning(),
    );
    expect(updated).toHaveLength(0);
    const deleted = await withTenant(db, orgA, (tx) =>
      tx.delete(services).where(eq(services.organizationId, orgB)).returning(),
    );
    expect(deleted).toHaveLength(0);
    const rowsB = await withTenant(db, orgB, (tx) => tx.select().from(services));
    expect(rowsB.map((r) => r.name)).toEqual(["Banho B"]);
  });

  it("o contexto do pet shop não vaza para a próxima transação da mesma conexão", async () => {
    await withTenant(db, orgA, (tx) => tx.select().from(shopProfiles));
    const rows = await db.select().from(services);
    expect(rows).toHaveLength(0);
  });

  it("o contexto de sistema enxerga todos os pet shops", async () => {
    const rows = await withSystem(db, (tx) =>
      tx
        .select()
        .from(services)
        .where(inArray(services.organizationId, [orgA, orgB])),
    );
    expect(rows).toHaveLength(2);
  });

  it("nem o dono das tabelas escapa do RLS (FORCE ROW LEVEL SECURITY)", async () => {
    const owner = postgres(OWNER_URL, { max: 1 });
    try {
      const rows = await owner`select * from services where organization_id in (${orgA}, ${orgB})`;
      expect(rows).toHaveLength(0);
    } finally {
      await owner.end();
    }
  });

  it("detecta quando a conexão ignora o RLS (superusuário)", async () => {
    expect((await checkDatabaseRole(db)).bypassesRls).toBe(false);
    const superUrl =
      process.env.TEST_DATABASE_URL_SUPERUSER ?? "postgres://postgres@localhost:5432/petshop_test";
    const superDb = createDb(superUrl, { max: 1 });
    try {
      expect((await checkDatabaseRole(superDb)).bypassesRls).toBe(true);
    } finally {
      await closeDb(superDb);
    }
  });
});
