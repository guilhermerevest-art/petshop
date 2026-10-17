import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Política de isolamento entre pet shops (RLS). A linha só é visível/gravável quando a transação
 * declarou o mesmo pet shop (`app.org_id`) ou está em contexto de sistema (`app.system`).
 * Ver `withTenant` e `withSystem` em ../tenancy.ts.
 */
function tenantCondition(column: AnyPgColumn): SQL {
  return sql`(${column} = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')`;
}

function tenantPolicy(column: AnyPgColumn) {
  const condition = tenantCondition(column);
  return pgPolicy("tenant_isolation", { as: "permissive", for: "all", using: condition, withCheck: condition });
}

const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export type SizeRangesJson = { P: number; M: number; G: number };
export type OnboardingJson = Partial<Record<OnboardingStep, string>>;
export const ONBOARDING_STEPS = ["dados", "horarios", "pix", "whatsapp", "equipe", "servicos"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Dados do pet shop além do que a autenticação guarda (nome, slug, logo ficam em `organization`). */
export const shopProfiles = pgTable(
  "shop_profiles",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    legalName: text("legal_name"),
    document: text("document"),
    phone: text("phone"),
    email: text("email"),
    addressZip: text("address_zip"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressDistrict: text("address_district"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    sizeRanges: jsonb("size_ranges")
      .$type<SizeRangesJson>()
      .notNull()
      .default(sql`'{"P":10,"M":25,"G":45}'::jsonb`),
    onboarding: jsonb("onboarding").$type<OnboardingJson>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [tenantPolicy(t.organizationId)],
);

/** Grade de vagas: em tal dia da semana, das X às Y, um horário a cada N minutos, com V vagas. */
export const capacityRules = pgTable(
  "capacity_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    intervalMinutes: smallint("interval_minutes").notNull(),
    slots: smallint("slots").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("capacity_rules_org_idx").on(t.organizationId, t.weekday), tenantPolicy(t.organizationId)],
);

/** Exceções por data: fechado (slots = 0) ou vagas diferentes numa faixa. */
export const capacityExceptions = pgTable(
  "capacity_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    date: date("date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    slots: smallint("slots").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("capacity_exceptions_org_date_idx").on(t.organizationId, t.date), tenantPolicy(t.organizationId)],
);

export const pixSettings = pgTable(
  "pix_settings",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    keyType: text("key_type").notNull(),
    key: text("key").notNull(),
    merchantName: text("merchant_name").notNull(),
    merchantCity: text("merchant_city").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [tenantPolicy(t.organizationId)],
);

export type WhatsAppStatus = "disconnected" | "connecting" | "connected";

export const whatsappInstances = pgTable(
  "whatsapp_instances",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    instanceName: text("instance_name").notNull(),
    server: text("server").notNull().default("default"),
    status: text("status").$type<WhatsAppStatus>().notNull().default("disconnected"),
    phoneNumber: text("phone_number"),
    profileName: text("profile_name"),
    profilePictureUrl: text("profile_picture_url"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsAcceptedBy: text("terms_accepted_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("whatsapp_instances_name_idx").on(t.instanceName), tenantPolicy(t.organizationId)],
);

export const SERVICE_CATEGORIES = ["banho", "tosa", "estetica", "saude", "outros"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    category: text("category").$type<ServiceCategory>().notNull().default("outros"),
    description: text("description"),
    isAddon: boolean("is_addon").notNull().default(false),
    showInPortal: boolean("show_in_portal").notNull().default(true),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("services_org_idx").on(t.organizationId), tenantPolicy(t.organizationId)],
);

/** Preço e duração de cada serviço por porte (P, M, G, GG). */
export const servicePrices = pgTable(
  "service_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    size: text("size").$type<"P" | "M" | "G" | "GG">().notNull(),
    priceCents: integer("price_cents").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
  },
  (t) => [uniqueIndex("service_prices_service_size_idx").on(t.serviceId, t.size), tenantPolicy(t.organizationId)],
);

/** Assinatura do pet shop com a plataforma. Gravada pelo sistema a partir dos webhooks do Stripe. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"stripe" | "fake">().notNull(),
    customerId: text("customer_id"),
    subscriptionId: text("subscription_id"),
    status: text("status").notNull(),
    priceId: text("price_id"),
    amountCents: integer("amount_cents"),
    currency: text("currency"),
    interval: text("interval"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    pastDueSince: timestamp("past_due_since", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscriptions_subscription_idx").on(t.subscriptionId),
    index("subscriptions_customer_idx").on(t.customerId),
    tenantPolicy(t.organizationId),
  ],
);

export type MessageDirection = "out" | "in";
export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "received";

/** Registro das mensagens de WhatsApp enviadas e recebidas. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    direction: text("direction").$type<MessageDirection>().notNull(),
    phone: text("phone").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<MessageStatus>().notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("messages_org_created_idx").on(t.organizationId, t.createdAt),
    index("messages_provider_idx").on(t.providerMessageId),
    tenantPolicy(t.organizationId),
  ],
);

/** Ações sensíveis. organization_id vazio = ação da plataforma (só visível em contexto de sistema). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt), tenantPolicy(t.organizationId)],
);

/** Eventos recebidos de webhooks (Stripe, Evolution). A unicidade garante processamento único. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").$type<"stripe" | "evolution">().notNull(),
    externalId: text("external_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_source_external_idx").on(t.source, t.externalId)],
);
