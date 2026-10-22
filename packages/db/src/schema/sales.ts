import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { services } from "./app";
import { appointments, appointmentServices, customers } from "./operation";
import { createdAt, organizationId, tenantPolicy, updatedAt } from "./helpers";

/** Caixa do dia: aberto com o troco inicial, fechado com a contagem do dinheiro. */
export const cashSessions = pgTable(
  "cash_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    openedBy: text("opened_by").references(() => user.id, { onDelete: "set null" }),
    openingCents: integer("opening_cents").notNull().default(0),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by").references(() => user.id, { onDelete: "set null" }),
    /** Dinheiro esperado na gaveta no fechamento (troco inicial + recebimentos em dinheiro). */
    expectedCents: integer("expected_cents"),
    /** Dinheiro contado no fechamento. */
    countedCents: integer("counted_cents"),
    notes: text("notes"),
  },
  (t) => [
    // Só um caixa aberto por pet shop.
    uniqueIndex("cash_sessions_one_open_idx")
      .on(t.organizationId)
      .where(sql`${t.closedAt} is null`),
    index("cash_sessions_org_opened_idx").on(t.organizationId, t.openedAt),
    tenantPolicy(t.organizationId),
  ],
);

export const ORDER_STATUSES = ["aberta", "paga", "cancelada"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Comanda: o que o tutor vai pagar (atendimento, produtos ou venda avulsa). */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    /** Número sequencial por pet shop, para falar no balcão ("comanda 42"). */
    number: integer("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<OrderStatus>().notNull().default("aberta"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes"),
    /** Código do link público do recibo. */
    receiptToken: text("receipt_token").notNull(),
    receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_org_number_idx").on(t.organizationId, t.number),
    uniqueIndex("orders_receipt_token_idx").on(t.receiptToken),
    // Um atendimento tem no máximo uma comanda ativa.
    uniqueIndex("orders_appointment_idx")
      .on(t.appointmentId)
      .where(sql`${t.appointmentId} is not null and ${t.status} <> 'cancelada'`),
    index("orders_org_status_idx").on(t.organizationId, t.status, t.createdAt),
    tenantPolicy(t.organizationId),
  ],
);

export const ORDER_ITEM_KINDS = ["servico", "produto", "avulso"] as const;
export type OrderItemKind = (typeof ORDER_ITEM_KINDS)[number];

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind").$type<OrderItemKind>().notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    appointmentServiceId: uuid("appointment_service_id").references(() => appointmentServices.id, {
      onDelete: "set null",
    }),
    /** Quem fez o serviço (base da comissão). */
    performedBy: text("performed_by").references(() => user.id, { onDelete: "set null" }),
    /** Comissão calculada quando a comanda é paga (percentual da pessoa naquele momento). */
    commissionCents: integer("commission_cents"),
    createdAt: createdAt(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), tenantPolicy(t.organizationId)],
);

export const PAYMENT_METHODS = ["pix", "dinheiro", "debito", "credito"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ["pendente", "confirmado", "cancelado"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id, {
      onDelete: "set null",
    }),
    method: text("method").$type<PaymentMethod>().notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** Em dinheiro: quanto o tutor entregou (o troco é a diferença). */
    receivedCents: integer("received_cents"),
    /** PIX fica pendente até alguém conferir no banco. */
    status: text("status").$type<PaymentStatus>().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: text("confirmed_by").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_session_idx").on(t.cashSessionId),
    index("payments_org_created_idx").on(t.organizationId, t.createdAt),
    tenantPolicy(t.organizationId),
  ],
);

/** Produto vendido no balcão (ração, petiscos, acessórios). */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    category: text("category"),
    barcode: text("barcode"),
    priceCents: integer("price_cents").notNull(),
    costCents: integer("cost_cents"),
    trackStock: boolean("track_stock").notNull().default(true),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_org_idx").on(t.organizationId),
    uniqueIndex("products_org_barcode_idx")
      .on(t.organizationId, t.barcode)
      .where(sql`${t.barcode} is not null and ${t.deletedAt} is null`),
    tenantPolicy(t.organizationId),
  ],
);

export const STOCK_REASONS = ["entrada", "venda", "ajuste", "perda", "estorno"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

/** Toda mudança no estoque fica registrada (quantidade positiva entra, negativa sai). */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").$type<StockReason>().notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    unitCostCents: integer("unit_cost_cents"),
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId, t.createdAt),
    tenantPolicy(t.organizationId),
  ],
);
