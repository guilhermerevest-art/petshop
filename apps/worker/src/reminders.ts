import { and, asc, eq, exists, gte, inArray, isNull, lt } from "drizzle-orm";
import { addDays, reminderMessage, toWhatsAppNumber, utcToZoned, zonedToUtc } from "@petshop/core";
import {
  appointmentPets,
  appointments,
  customers,
  messages,
  organization,
  pets,
  shopProfiles,
  whatsappInstances,
  withSystem,
  withTenant,
  type Database,
} from "@petshop/db";
import type { MessagingProvider } from "@petshop/integrations";

/** A partir desta hora (no fuso do pet shop) saem os lembretes dos agendamentos do dia seguinte. */
export const REMINDER_HOUR = 18;

export interface ReminderResult {
  shops: number;
  sent: number;
  failed: number;
}

/**
 * Lembrete pelo WhatsApp na véspera, para agendamentos ainda não cancelados.
 * Cada agendamento é reservado (reminder_sent_at) antes do envio, então duas execuções ao mesmo tempo não duplicam.
 */
export async function sendReminders(
  db: Database,
  messaging: MessagingProvider,
  now = new Date(),
): Promise<ReminderResult> {
  const result: ReminderResult = { shops: 0, sent: 0, failed: 0 };
  const shops = await withSystem(db, (tx) =>
    tx
      .select({
        organizationId: whatsappInstances.organizationId,
        instanceName: whatsappInstances.instanceName,
        shopName: organization.name,
        timezone: shopProfiles.timezone,
      })
      .from(whatsappInstances)
      .innerJoin(organization, eq(organization.id, whatsappInstances.organizationId))
      .innerJoin(shopProfiles, eq(shopProfiles.organizationId, whatsappInstances.organizationId))
      .where(eq(whatsappInstances.status, "connected")),
  );

  for (const shop of shops) {
    const local = utcToZoned(now, shop.timezone);
    if (local.minutes < REMINDER_HOUR * 60) continue;
    result.shops++;
    const tomorrow = addDays(local.date, 1);
    const from = zonedToUtc(tomorrow, 0, shop.timezone);
    const to = zonedToUtc(tomorrow, 24 * 60, shop.timezone);

    const due = await withTenant(db, shop.organizationId, async (tx) => {
      const pending = tx
        .select({ id: appointmentPets.id })
        .from(appointmentPets)
        .where(
          and(
            eq(appointmentPets.appointmentId, appointments.id),
            eq(appointmentPets.status, "agendado"),
          ),
        );
      const claimed = await tx
        .update(appointments)
        .set({ reminderSentAt: now })
        .where(
          and(
            eq(appointments.organizationId, shop.organizationId),
            gte(appointments.startsAt, from),
            lt(appointments.startsAt, to),
            isNull(appointments.canceledAt),
            isNull(appointments.reminderSentAt),
            exists(pending),
          ),
        )
        .returning({
          id: appointments.id,
          customerId: appointments.customerId,
          startsAt: appointments.startsAt,
        });
      if (claimed.length === 0) return [];
      const people = await tx
        .select({ id: customers.id, name: customers.name, phone: customers.phone })
        .from(customers)
        .where(
          inArray(
            customers.id,
            claimed.map((c) => c.customerId),
          ),
        );
      const petRows = await tx
        .select({ appointmentId: appointmentPets.appointmentId, name: pets.name })
        .from(appointmentPets)
        .innerJoin(pets, eq(pets.id, appointmentPets.petId))
        .where(
          and(
            inArray(
              appointmentPets.appointmentId,
              claimed.map((c) => c.id),
            ),
            eq(appointmentPets.status, "agendado"),
          ),
        )
        .orderBy(asc(appointmentPets.createdAt));
      return claimed.map((c) => ({
        ...c,
        customer: people.find((p) => p.id === c.customerId)!,
        pets: petRows
          .filter((p) => p.appointmentId === c.id)
          .map((p) => ({ name: p.name, services: [] })),
      }));
    });

    for (const item of due) {
      const body = reminderMessage({
        shopName: shop.shopName,
        customerName: item.customer.name,
        startMinutes: utcToZoned(item.startsAt, shop.timezone).minutes,
        pets: item.pets,
      });
      let providerMessageId: string | null = null;
      let error: string | null = null;
      try {
        providerMessageId = (
          await messaging.sendText(shop.instanceName, toWhatsAppNumber(item.customer.phone), body)
        ).id;
        result.sent++;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
        result.failed++;
      }
      await withTenant(db, shop.organizationId, (tx) =>
        tx.insert(messages).values({
          organizationId: shop.organizationId,
          direction: "out",
          phone: item.customer.phone,
          kind: "lembrete",
          body,
          status: error ? "failed" : "sent",
          providerMessageId,
          error,
        }),
      );
    }
  }
  return result;
}
