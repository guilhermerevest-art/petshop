"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import {
  cancellationMessage,
  checkInMessage,
  confirmationMessage,
  formatLocalDate,
  formatTime,
  isLocalDate,
  readyMessage,
  utcToZoned,
} from "@petshop/core";
import {
  appointmentEvents,
  appointmentPets,
  appointments,
  appointmentServices,
  customers,
  pets,
  servicePrices,
  services,
  type PetStatus,
} from "@petshop/db";
import { createAppointment, type NewAppointmentPet } from "@petshop/db/scheduling";
import { can } from "@/lib/permissions";
import { fail, inShop, ok, shopForAction, type ActionResult, type ShopContext } from "@/lib/shop";
import { NEXT_STATUS } from "@/lib/status";
import { sendShopMessage } from "@/lib/whatsapp";

const petsSchema = z
  .array(z.object({ petId: z.string().uuid(), serviceIds: z.array(z.string().uuid()).min(1) }))
  .min(1);

const createSchema = z.object({
  customerId: z.string().uuid({ error: "Escolha o cliente." }),
  date: z.string().refine(isLocalDate, "Escolha a data."),
  start: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60, { error: "Escolha o horário." }),
  overbook: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Avisa o tutor pelo WhatsApp do pet shop, sem atrapalhar a operação se não der. */
async function notify(ctx: ShopContext, phone: string, body: string, kind: string) {
  await sendShopMessage(ctx, phone, body, kind).catch((error) => console.error("notify", error));
}

export async function createAppointmentAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("agenda.book");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Confira os dados do agendamento.");
  let selection: z.infer<typeof petsSchema>;
  try {
    selection = petsSchema.parse(JSON.parse(String(formData.get("pets") ?? "[]")));
  } catch {
    return fail("Escolha pelo menos um pet e um serviço para cada pet.");
  }
  const input = parsed.data;
  if (input.overbook && !can(ctx.role, "agenda.overbook")) {
    return fail("Só o dono ou o gerente podem fazer encaixe acima das vagas.");
  }
  const orgId = ctx.organization.id;

  const result = await inShop(ctx, async (tx) => {
    const customer = await tx.query.customers.findFirst({
      where: and(
        eq(customers.id, input.customerId),
        eq(customers.organizationId, orgId),
        isNull(customers.deletedAt),
      ),
    });
    if (!customer) return { error: "Cliente não encontrado." } as const;
    const petRows = await tx
      .select()
      .from(pets)
      .where(
        and(
          eq(pets.customerId, customer.id),
          inArray(
            pets.id,
            selection.map((s) => s.petId),
          ),
          isNull(pets.deletedAt),
        ),
      );
    const serviceIds = [...new Set(selection.flatMap((s) => s.serviceIds))];
    const serviceRows = await tx
      .select({ service: services, price: servicePrices })
      .from(services)
      .innerJoin(servicePrices, eq(servicePrices.serviceId, services.id))
      .where(
        and(
          inArray(services.id, serviceIds),
          eq(services.organizationId, orgId),
          isNull(services.deletedAt),
        ),
      );

    const planned: NewAppointmentPet[] = [];
    for (const item of selection) {
      const pet = petRows.find((p) => p.id === item.petId);
      if (!pet) return { error: "Um dos pets não é deste cliente." } as const;
      const chosen = item.serviceIds.map((serviceId) =>
        serviceRows.find((r) => r.service.id === serviceId && r.price.size === pet.size),
      );
      if (chosen.some((c) => !c))
        return { error: `Falta preço de algum serviço para o porte de ${pet.name}.` } as const;
      planned.push({
        petId: pet.id,
        size: pet.size,
        services: chosen.map((c) => ({
          serviceId: c!.service.id,
          name: c!.service.name,
          isAddon: c!.service.isAddon,
          priceCents: c!.price.priceCents,
          durationMinutes: c!.price.durationMinutes,
        })),
      });
    }

    const created = await createAppointment(tx, {
      organizationId: orgId,
      customerId: customer.id,
      localDate: input.date,
      startMinutes: input.start,
      timeZone: ctx.profile.timezone,
      pets: planned,
      allowOverbooking: input.overbook,
      origin: "balcao",
      notes: input.notes,
      createdBy: ctx.user.id,
    });
    if (!created.ok) {
      const pet = petRows.find((p) => p.id === planned[created.petIndex]?.petId);
      return {
        error:
          created.reason === "sem_vaga"
            ? `Não há vaga para ${pet?.name ?? "o pet"} às ${formatTime(input.start)} durante todo o atendimento. Escolha outro horário.`
            : "Escolha pelo menos um serviço para cada pet.",
      } as const;
    }
    return { appointmentId: created.appointmentId, customer, planned, petRows } as const;
  });

  if ("error" in result) return fail(result.error ?? "Não foi possível agendar.");

  const totalCents = result.planned.reduce(
    (sum, p) => sum + p.services.reduce((s, x) => s + x.priceCents, 0),
    0,
  );
  await notify(
    ctx,
    result.customer.phone,
    confirmationMessage({
      shopName: ctx.organization.name,
      customerName: result.customer.name,
      dateLabel: formatLocalDate(input.date),
      startMinutes: input.start,
      pets: result.planned.map((p) => ({
        name: result.petRows.find((r) => r.id === p.petId)!.name,
        services: p.services.map((s) => s.name),
      })),
      totalCents,
    }),
    "confirmacao",
  );
  revalidatePath("/app", "layout");
  redirect(`/app/agenda?data=${input.date}&novo=${result.appointmentId}`);
}

const TIMESTAMP_FOR: Partial<
  Record<PetStatus, "checkedInAt" | "startedAt" | "readyAt" | "completedAt">
> = {
  check_in: "checkedInAt",
  em_atendimento: "startedAt",
  pronto: "readyAt",
  concluido: "completedAt",
};

/** Avança o pet na fila (chegou, em atendimento, pronto, entregue) ou marca falta. */
export async function updatePetStatusAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("agenda.operate");
  if ("error" in ctx) return fail(ctx.error);
  const appointmentPetId = z.string().uuid().safeParse(formData.get("appointmentPetId"));
  const to = String(formData.get("to")) as PetStatus;
  if (!appointmentPetId.success) return fail("Atendimento não encontrado.");

  const result = await inShop(ctx, async (tx) => {
    const [row] = await tx
      .select({ entry: appointmentPets, petName: pets.name, phone: customers.phone })
      .from(appointmentPets)
      .innerJoin(pets, eq(pets.id, appointmentPets.petId))
      .innerJoin(appointments, eq(appointments.id, appointmentPets.appointmentId))
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .where(
        and(
          eq(appointmentPets.id, appointmentPetId.data),
          eq(appointmentPets.organizationId, ctx.organization.id),
        ),
      )
      .limit(1);
    if (!row) return { error: "Atendimento não encontrado." } as const;
    const from = row.entry.status;
    const allowed =
      NEXT_STATUS[from]?.to === to || (to === "nao_compareceu" && from === "agendado");
    if (!allowed)
      return {
        error: "Este passo não vale para a situação atual do pet. Atualize a página.",
      } as const;
    const stamp = TIMESTAMP_FOR[to];
    await tx
      .update(appointmentPets)
      .set({ status: to, ...(stamp ? { [stamp]: new Date() } : {}) })
      .where(eq(appointmentPets.id, row.entry.id));
    if (to === "concluido") {
      // Quem entregou fica registrado como responsável pelos serviços que ainda não tinham ninguém.
      await tx
        .update(appointmentServices)
        .set({ performedBy: ctx.user.id })
        .where(
          and(
            eq(appointmentServices.appointmentPetId, row.entry.id),
            isNull(appointmentServices.performedBy),
          ),
        );
    }
    if (to === "em_atendimento") {
      await tx
        .update(appointmentServices)
        .set({ performedBy: ctx.user.id })
        .where(eq(appointmentServices.appointmentPetId, row.entry.id));
    }
    await tx.insert(appointmentEvents).values({
      organizationId: ctx.organization.id,
      appointmentId: row.entry.appointmentId,
      appointmentPetId: row.entry.id,
      type: "status",
      fromStatus: from,
      toStatus: to,
      actorUserId: ctx.user.id,
    });
    return { petName: row.petName, phone: row.phone } as const;
  });
  if ("error" in result) return fail(result.error ?? "Não foi possível atualizar.");

  if (to === "check_in") {
    await notify(
      ctx,
      result.phone,
      checkInMessage({ shopName: ctx.organization.name, petName: result.petName }),
      "check_in",
    );
  } else if (to === "pronto") {
    await notify(
      ctx,
      result.phone,
      readyMessage({ shopName: ctx.organization.name, petName: result.petName }),
      "pronto",
    );
  }
  revalidatePath("/app", "layout");
  const messages: Partial<Record<PetStatus, string>> = {
    check_in: `${result.petName} chegou`,
    em_atendimento: `Atendimento de ${result.petName} começou`,
    pronto: `${result.petName} está pronto. Avisamos o tutor.`,
    concluido: `${result.petName} foi entregue`,
    nao_compareceu: `Falta de ${result.petName} registrada`,
  };
  return ok(messages[to]);
}

const cancelSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
  notifyCustomer: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function cancelAppointmentAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("agenda.book");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Agendamento não encontrado.");
  const { appointmentId, reason, notifyCustomer } = parsed.data;

  const result = await inShop(ctx, async (tx) => {
    const appointment = await tx.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.organizationId, ctx.organization.id),
      ),
    });
    if (!appointment || appointment.canceledAt) return null;
    await tx
      .update(appointments)
      .set({ canceledAt: new Date(), cancelReason: reason })
      .where(eq(appointments.id, appointmentId));
    await tx
      .update(appointmentPets)
      .set({ status: "cancelado" })
      .where(
        and(
          eq(appointmentPets.appointmentId, appointmentId),
          notInArray(appointmentPets.status, ["concluido", "nao_compareceu"]),
        ),
      );
    await tx.insert(appointmentEvents).values({
      organizationId: ctx.organization.id,
      appointmentId,
      type: "cancelado",
      toStatus: "cancelado",
      actorUserId: ctx.user.id,
      data: reason ? { motivo: reason } : null,
    });
    const customer = await tx.query.customers.findFirst({
      where: eq(customers.id, appointment.customerId),
    });
    return { appointment, customer: customer! };
  });
  if (!result) return fail("Este agendamento já foi cancelado.");

  const local = utcToZoned(result.appointment.startsAt, ctx.profile.timezone);
  if (notifyCustomer) {
    await notify(
      ctx,
      result.customer.phone,
      cancellationMessage({
        shopName: ctx.organization.name,
        customerName: result.customer.name,
        dateLabel: formatLocalDate(local.date),
        startMinutes: local.minutes,
      }),
      "cancelamento",
    );
  }
  revalidatePath("/app", "layout");
  redirect(`/app/agenda?data=${local.date}&cancelado=1`);
}

/** Registra que o tutor confirmou presença (por telefone ou WhatsApp). */
export async function confirmAppointmentAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("agenda.book");
  if ("error" in ctx) return fail(ctx.error);
  const id = z.string().uuid().safeParse(formData.get("appointmentId"));
  if (!id.success) return fail("Agendamento não encontrado.");
  await inShop(ctx, async (tx) => {
    await tx
      .update(appointments)
      .set({ confirmedAt: new Date() })
      .where(
        and(eq(appointments.id, id.data), eq(appointments.organizationId, ctx.organization.id)),
      );
    await tx.insert(appointmentEvents).values({
      organizationId: ctx.organization.id,
      appointmentId: id.data,
      type: "confirmado_pelo_tutor",
      actorUserId: ctx.user.id,
    });
  });
  revalidatePath("/app", "layout");
  return ok("Presença confirmada");
}
