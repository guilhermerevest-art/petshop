import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { services } from "./app";
import { createdAt, organizationId, tenantPolicy, updatedAt } from "./helpers";

/** Tutor (cliente do pet shop). O celular identifica o tutor dentro do pet shop (RN-02). */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    document: text("document"),
    addressZip: text("address_zip"),
    addressStreet: text("address_street"),
    addressNumber: text("address_number"),
    addressComplement: text("address_complement"),
    addressDistrict: text("address_district"),
    addressCity: text("address_city"),
    addressState: text("address_state"),
    origin: text("origin"),
    notes: text("notes"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    marketingOptInAt: timestamp("marketing_opt_in_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("customers_org_phone_idx")
      .on(t.organizationId, t.phone)
      .where(sql`${t.deletedAt} is null`),
    index("customers_org_name_idx").on(t.organizationId, t.name),
    tenantPolicy(t.organizationId),
  ],
);

export const SPECIES = ["cao", "gato", "outro"] as const;
export type Species = (typeof SPECIES)[number];
export const COATS = ["curta", "media", "longa"] as const;
export type Coat = (typeof COATS)[number];

export const pets = pgTable(
  "pets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    species: text("species").$type<Species>().notNull().default("cao"),
    breed: text("breed"),
    sex: text("sex").$type<"macho" | "femea">(),
    birthDate: date("birth_date"),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2, mode: "number" }),
    size: text("size").$type<"P" | "M" | "G" | "GG">().notNull(),
    coat: text("coat").$type<Coat>(),
    neutered: boolean("neutered"),
    color: text("color"),
    /** Alertas que a equipe precisa ver antes de pegar o pet. */
    temperament: text("temperament"),
    allergies: text("allergies"),
    restrictions: text("restrictions"),
    notes: text("notes"),
    bathFrequencyDays: integer("bath_frequency_days"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("pets_org_customer_idx").on(t.organizationId, t.customerId),
    tenantPolicy(t.organizationId),
  ],
);

export const APPOINTMENT_ORIGINS = ["balcao", "portal", "whatsapp"] as const;

/** Agendamento: um tutor, um horário de início e um ou mais pets. */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    origin: text("origin")
      .$type<(typeof APPOINTMENT_ORIGINS)[number]>()
      .notNull()
      .default("balcao"),
    notes: text("notes"),
    /** Tutor confirmou pelo lembrete. */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_org_starts_idx").on(t.organizationId, t.startsAt),
    tenantPolicy(t.organizationId),
  ],
);

export const PET_STATUSES = [
  "agendado",
  "check_in",
  "em_atendimento",
  "pronto",
  "concluido",
  "cancelado",
  "nao_compareceu",
] as const;
export type PetStatus = (typeof PET_STATUSES)[number];

/** Cada pet do agendamento ocupa uma vaga de `startsAt` a `endsAt` e anda no seu próprio ritmo. */
export const appointmentPets = pgTable(
  "appointment_pets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** Porte no momento do agendamento (define preço e duração). */
    size: text("size").$type<"P" | "M" | "G" | "GG">().notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").$type<PetStatus>().notNull().default("agendado"),
    /** Encaixe acima da capacidade, feito com permissão. */
    overbooked: boolean("overbooked").notNull().default(false),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointment_pets_org_time_idx").on(t.organizationId, t.startsAt, t.endsAt),
    index("appointment_pets_appointment_idx").on(t.appointmentId),
    index("appointment_pets_pet_idx").on(t.petId),
    tenantPolicy(t.organizationId),
  ],
);

/** Serviços de cada pet, com preço e duração copiados no momento do agendamento. */
export const appointmentServices = pgTable(
  "appointment_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    appointmentPetId: uuid("appointment_pet_id")
      .notNull()
      .references(() => appointmentPets.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    isAddon: boolean("is_addon").notNull().default(false),
    priceCents: integer("price_cents").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    /** Quem fez o serviço (base da comissão). */
    performedBy: text("performed_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointment_services_pet_idx").on(t.appointmentPetId),
    tenantPolicy(t.organizationId),
  ],
);

/** Histórico de cada mudança no agendamento (quem, quando, de que status para qual). */
export const appointmentEvents = pgTable(
  "appointment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    appointmentPetId: uuid("appointment_pet_id").references(() => appointmentPets.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointment_events_appointment_idx").on(t.appointmentId),
    tenantPolicy(t.organizationId),
  ],
);

/** Comissão opcional por pessoa da equipe, definida pelo gestor (percentual sobre os serviços pagos). */
export const memberCommissions = pgTable(
  "member_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: organizationId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    percent: numeric("percent", { precision: 5, scale: 2, mode: "number" }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("member_commissions_org_user_idx").on(t.organizationId, t.userId),
    tenantPolicy(t.organizationId),
  ],
);
