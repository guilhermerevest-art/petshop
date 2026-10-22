import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { onlyDigits } from "@petshop/core";
import { appointmentPets, appointments, appointmentServices, customers, pets } from "@petshop/db";
import { inShop, type ShopContext } from "./shop";

export type Customer = typeof customers.$inferSelect;
export type Pet = typeof pets.$inferSelect;

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string; species: string; size: string }[];
}

/** Busca por nome do tutor, celular ou nome do pet. */
export async function searchCustomers(
  ctx: ShopContext,
  query: string,
  limit = 50,
): Promise<CustomerListItem[]> {
  const orgId = ctx.organization.id;
  const term = query.trim();
  const digits = onlyDigits(term);
  return inShop(ctx, async (tx) => {
    const conditions = [eq(customers.organizationId, orgId), isNull(customers.deletedAt)];
    if (term) {
      const like = `%${term.replace(/[%_]/g, "")}%`;
      const petMatch = tx
        .select({ id: pets.customerId })
        .from(pets)
        .where(and(eq(pets.organizationId, orgId), isNull(pets.deletedAt), ilike(pets.name, like)));
      conditions.push(
        or(
          ilike(customers.name, like),
          digits.length >= 4 ? ilike(customers.phone, `%${digits}%`) : undefined,
          inArray(customers.id, petMatch),
        )!,
      );
    }
    const rows = await tx
      .select({ id: customers.id, name: customers.name, phone: customers.phone })
      .from(customers)
      .where(and(...conditions))
      .orderBy(term ? asc(customers.name) : desc(customers.createdAt))
      .limit(limit);
    const petRows = rows.length
      ? await tx
          .select({
            id: pets.id,
            customerId: pets.customerId,
            name: pets.name,
            species: pets.species,
            size: pets.size,
          })
          .from(pets)
          .where(
            and(
              inArray(
                pets.customerId,
                rows.map((r) => r.id),
              ),
              isNull(pets.deletedAt),
            ),
          )
          .orderBy(asc(pets.name))
      : [];
    return rows.map((r) => ({ ...r, pets: petRows.filter((p) => p.customerId === r.id) }));
  });
}

export interface CustomerHistoryItem {
  appointmentId: string;
  startsAt: Date;
  canceled: boolean;
  pets: { name: string; status: string; services: string[]; totalCents: number }[];
}

export async function getCustomer(ctx: ShopContext, id: string) {
  const orgId = ctx.organization.id;
  return inShop(ctx, async (tx) => {
    const customer = await tx.query.customers.findFirst({
      where: and(
        eq(customers.id, id),
        eq(customers.organizationId, orgId),
        isNull(customers.deletedAt),
      ),
    });
    if (!customer) return null;
    const petList = await tx
      .select()
      .from(pets)
      .where(and(eq(pets.customerId, id), isNull(pets.deletedAt)))
      .orderBy(asc(pets.createdAt));
    const history = await tx
      .select({
        appointmentId: appointments.id,
        startsAt: appointments.startsAt,
        canceledAt: appointments.canceledAt,
        petName: pets.name,
        status: appointmentPets.status,
        appointmentPetId: appointmentPets.id,
      })
      .from(appointments)
      .innerJoin(appointmentPets, eq(appointmentPets.appointmentId, appointments.id))
      .innerJoin(pets, eq(pets.id, appointmentPets.petId))
      .where(eq(appointments.customerId, id))
      .orderBy(desc(appointments.startsAt))
      .limit(60);
    const serviceRows = history.length
      ? await tx
          .select({
            appointmentPetId: appointmentServices.appointmentPetId,
            name: appointmentServices.name,
            priceCents: appointmentServices.priceCents,
          })
          .from(appointmentServices)
          .where(
            inArray(
              appointmentServices.appointmentPetId,
              history.map((h) => h.appointmentPetId),
            ),
          )
      : [];
    const grouped = new Map<string, CustomerHistoryItem>();
    for (const row of history) {
      let item = grouped.get(row.appointmentId);
      if (!item) {
        item = {
          appointmentId: row.appointmentId,
          startsAt: row.startsAt,
          canceled: Boolean(row.canceledAt),
          pets: [],
        };
        grouped.set(row.appointmentId, item);
      }
      const services = serviceRows.filter((s) => s.appointmentPetId === row.appointmentPetId);
      item.pets.push({
        name: row.petName,
        status: row.status,
        services: services.map((s) => s.name),
        totalCents: services.reduce((sum, s) => sum + s.priceCents, 0),
      });
    }
    return { customer, pets: petList, history: [...grouped.values()] };
  });
}

/** Cliente com o mesmo celular (para avisar em vez de duplicar). */
export async function findCustomerByPhone(ctx: ShopContext, phone: string, exceptId?: string) {
  return inShop(ctx, async (tx) => {
    const rows = await tx
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.organization.id),
          eq(customers.phone, phone),
          isNull(customers.deletedAt),
          exceptId ? sql`${customers.id} <> ${exceptId}` : undefined,
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

/** Tutor com os pets ativos, no formato da lista (usado no agendamento). */
export async function getCustomerListItem(
  ctx: ShopContext,
  id: string,
): Promise<CustomerListItem | null> {
  const orgId = ctx.organization.id;
  return inShop(ctx, async (tx) => {
    const customer = await tx.query.customers.findFirst({
      where: and(
        eq(customers.id, id),
        eq(customers.organizationId, orgId),
        isNull(customers.deletedAt),
      ),
      columns: { id: true, name: true, phone: true },
    });
    if (!customer) return null;
    const petRows = await tx
      .select({ id: pets.id, name: pets.name, species: pets.species, size: pets.size })
      .from(pets)
      .where(and(eq(pets.customerId, id), isNull(pets.deletedAt)))
      .orderBy(asc(pets.name));
    return { ...customer, pets: petRows };
  });
}
