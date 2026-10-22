import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, createDb, type Database } from "../src/client";
import { runMigrations } from "../src/migrate";
import {
  appointmentPets,
  appointments,
  appointmentServices,
  customers,
  memberCommissions,
  orderItems,
  organization,
  pets,
  products,
  stockMovements,
  user,
} from "../src/schema";
import {
  addPayment,
  cancelOrder,
  closeCash,
  confirmPayment,
  createOrder,
  editOrder,
  openCash,
  orderForAppointment,
} from "../src/sales";
import { withTenant } from "../src/tenancy";

const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://petshop_app:petshop_app@localhost:5432/petshop_test";
const OWNER_URL =
  process.env.TEST_DATABASE_URL_OWNER ??
  "postgres://petshop_owner:petshop_owner@localhost:5432/petshop_test";

let db: Database;
const org = `sales_${randomUUID()}`;
const groomer = `sales_user_${randomUUID()}`;
let customerId: string;
let appointmentId: string;
let productId: string;

const run = <T>(fn: Parameters<typeof withTenant<T>>[2]) => withTenant(db, org, fn);

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  db = createDb(APP_URL, { max: 4 });
  const now = new Date();
  await db.insert(organization).values({ id: org, name: "Vendas", slug: org, createdAt: now });
  await db.insert(user).values({
    id: groomer,
    name: "Bia",
    email: `${groomer}@exemplo.com.br`,
    createdAt: now,
    updatedAt: now,
  });
  await run(async (tx) => {
    const [c] = await tx
      .insert(customers)
      .values({ organizationId: org, name: "Tutor", phone: "+5519987654321" })
      .returning();
    customerId = c!.id;
    const [thor] = await tx
      .insert(pets)
      .values({ organizationId: org, customerId, name: "Thor", size: "P" })
      .returning();
    const [mel] = await tx
      .insert(pets)
      .values({ organizationId: org, customerId, name: "Mel", size: "M" })
      .returning();
    const [a] = await tx
      .insert(appointments)
      .values({ organizationId: org, customerId, startsAt: now })
      .returning();
    appointmentId = a!.id;
    const [ap1] = await tx
      .insert(appointmentPets)
      .values({
        organizationId: org,
        appointmentId,
        petId: thor!.id,
        size: "P",
        startsAt: now,
        endsAt: now,
        status: "concluido",
      })
      .returning();
    const [ap2] = await tx
      .insert(appointmentPets)
      .values({
        organizationId: org,
        appointmentId,
        petId: mel!.id,
        size: "M",
        startsAt: now,
        endsAt: now,
        status: "nao_compareceu",
      })
      .returning();
    await tx.insert(appointmentServices).values([
      {
        organizationId: org,
        appointmentPetId: ap1!.id,
        name: "Banho",
        priceCents: 5000,
        durationMinutes: 60,
        performedBy: groomer,
      },
      {
        organizationId: org,
        appointmentPetId: ap1!.id,
        name: "Hidratação",
        isAddon: true,
        priceCents: 2500,
        durationMinutes: 15,
        performedBy: groomer,
      },
      {
        organizationId: org,
        appointmentPetId: ap2!.id,
        name: "Banho",
        priceCents: 6500,
        durationMinutes: 75,
      },
    ]);
    await tx
      .insert(memberCommissions)
      .values({ organizationId: org, userId: groomer, percent: 40 });
    const [p] = await tx
      .insert(products)
      .values({ organizationId: org, name: "Petisco", priceCents: 1500, stockQuantity: 10 })
      .returning();
    productId = p!.id;
  });
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, org));
  await db.delete(user).where(eq(user.id, groomer));
  await closeDb(db);
});

describe("comanda e pagamentos", () => {
  it("monta a comanda do atendimento só com os pets atendidos, sem duplicar", async () => {
    const first = await run((tx) =>
      orderForAppointment(tx, { organizationId: org, appointmentId, createdBy: null }),
    );
    expect(first.ok && first.created).toBe(true);
    if (!first.ok) return;
    expect(first.order.totalCents).toBe(7500);
    const second = await run((tx) =>
      orderForAppointment(tx, { organizationId: org, appointmentId, createdBy: null }),
    );
    expect(second.ok && second.order.id).toBe(first.order.id);
    expect(second.ok && second.created).toBe(false);
  });

  it("numera as comandas em sequência", async () => {
    const a = await run((tx) => createOrder(tx, { organizationId: org, createdBy: null }));
    const b = await run((tx) => createOrder(tx, { organizationId: org, createdBy: null }));
    expect(b.number).toBe(a.number + 1);
  });

  it("PIX fica pendente até conferir; dinheiro exige caixa; comissão e estoque na quitação", async () => {
    const order = await run((tx) =>
      createOrder(tx, { organizationId: org, customerId, createdBy: null }),
    );
    await run((tx) =>
      editOrder(tx, {
        organizationId: org,
        orderId: order.id,
        addItem: {
          kind: "servico",
          description: "Banho",
          quantity: 1,
          unitPriceCents: 10000,
          performedBy: groomer,
        },
      }),
    );
    await run((tx) =>
      editOrder(tx, {
        organizationId: org,
        orderId: order.id,
        addItem: {
          kind: "produto",
          description: "Petisco",
          quantity: 2,
          unitPriceCents: 1500,
          productId,
        },
      }),
    );
    const discounted = await run((tx) =>
      editOrder(tx, { organizationId: org, orderId: order.id, discountCents: 1300 }),
    );
    expect(discounted.ok && discounted.order.totalCents).toBe(11700);

    const noCash = await run((tx) =>
      addPayment(tx, {
        organizationId: org,
        orderId: order.id,
        method: "dinheiro",
        amountCents: 1700,
        userId: groomer,
      }),
    );
    expect(noCash).toEqual({ ok: false, error: "caixa_fechado" });

    const opened = await run((tx) =>
      openCash(tx, { organizationId: org, openingCents: 10000, userId: groomer }),
    );
    expect(opened.ok).toBe(true);
    const twice = await run((tx) =>
      openCash(tx, { organizationId: org, openingCents: 0, userId: groomer }),
    );
    expect(twice).toEqual({ ok: false, error: "caixa_ja_aberto" });

    const pix = await run((tx) =>
      addPayment(tx, {
        organizationId: org,
        orderId: order.id,
        method: "pix",
        amountCents: 10000,
        userId: groomer,
      }),
    );
    expect(pix.ok && pix.payment.status).toBe("pendente");
    expect(pix.ok && pix.paid).toBe(false);

    const tooMuch = await run((tx) =>
      addPayment(tx, {
        organizationId: org,
        orderId: order.id,
        method: "debito",
        amountCents: 1701,
        userId: groomer,
      }),
    );
    expect(tooMuch).toEqual({ ok: false, error: "acima_do_restante" });

    const blocked = await run((tx) =>
      editOrder(tx, { organizationId: org, orderId: order.id, discountCents: 0 }),
    );
    expect(blocked).toEqual({ ok: false, error: "tem_pagamento" });

    const cash = await run((tx) =>
      addPayment(tx, {
        organizationId: org,
        orderId: order.id,
        method: "dinheiro",
        amountCents: 1700,
        receivedCents: 2000,
        userId: groomer,
      }),
    );
    expect(cash.ok && cash.paid).toBe(false); // o PIX ainda não foi conferido

    const confirmed = await run((tx) =>
      confirmPayment(tx, {
        organizationId: org,
        paymentId: pix.ok ? pix.payment.id : "",
        userId: groomer,
      }),
    );
    expect(confirmed.ok && confirmed.paid).toBe(true);

    // 40% de R$ 100,00 com o desconto proporcional (11700/13000 = 90%) = R$ 36,00
    const items = await run((tx) =>
      tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    );
    expect(items.find((i) => i.kind === "servico")?.commissionCents).toBe(3600);
    const [product] = await run((tx) =>
      tx.select().from(products).where(eq(products.id, productId)),
    );
    expect(product?.stockQuantity).toBe(8);
    const moves = await run((tx) =>
      tx.select().from(stockMovements).where(eq(stockMovements.productId, productId)),
    );
    expect(moves.map((m) => m.delta)).toEqual([-2]);

    const cancel = await run((tx) =>
      cancelOrder(tx, { organizationId: org, orderId: order.id, reason: null }),
    );
    expect(cancel).toEqual({ ok: false, error: "comanda_fechada" });

    const closed = await run((tx) =>
      closeCash(tx, { organizationId: org, countedCents: 11500, userId: groomer }),
    );
    expect(closed.ok && closed.summary.expectedCashCents).toBe(11700);
    expect(closed.ok && closed.summary.byMethod.pix).toBe(10000);
  });
});
