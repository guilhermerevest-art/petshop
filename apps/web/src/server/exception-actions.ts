"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, lt, notInArray, count } from "drizzle-orm";
import { z } from "zod";
import { isLocalDate, parseTime, todayIn, zonedToUtc } from "@petshop/core";
import { appointmentPets, capacityExceptions } from "@petshop/db";
import { FREE_STATUSES } from "@petshop/db/scheduling";
import { audit } from "@/lib/audit";
import { fail, inShop, ok, shopForAction, type ActionResult } from "@/lib/shop";

const exceptionSchema = z
  .object({
    date: z.string().refine(isLocalDate, "Escolha a data."),
    kind: z.enum(["fechado", "vagas"]),
    start: z.string().optional(),
    end: z.string().optional(),
    slots: z.coerce.number().int().min(0).max(50).optional(),
    reason: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "vagas") return;
    const start = parseTime(value.start ?? "");
    const end = parseTime(value.end ?? "");
    if (start === null)
      ctx.addIssue({ code: "custom", path: ["start"], message: "Informe o início." });
    if (end === null) ctx.addIssue({ code: "custom", path: ["end"], message: "Informe o fim." });
    if (start !== null && end !== null && end <= start)
      ctx.addIssue({ code: "custom", path: ["end"], message: "O fim vem depois do início." });
    if (value.slots === undefined)
      ctx.addIssue({ code: "custom", path: ["slots"], message: "Informe as vagas." });
  });

/** Dia especial: fechado o dia todo ou com outro número de vagas numa faixa de horário. */
export async function addCapacityExceptionAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("schedule.edit");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = exceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
    );
    return fail("Confira os campos destacados.", fieldErrors);
  }
  const data = parsed.data;
  if (data.date < todayIn(ctx.profile.timezone))
    return fail("Escolha hoje ou uma data futura.", { date: "Data passada." });
  const closed = data.kind === "fechado";

  const booked = await inShop(ctx, async (tx) => {
    await tx.insert(capacityExceptions).values({
      organizationId: ctx.organization.id,
      date: data.date,
      startTime: closed ? null : data.start!,
      endTime: closed ? null : data.end!,
      slots: closed ? 0 : data.slots!,
      reason: data.reason,
    });
    await audit(tx, ctx, "horarios.dia_especial", { data: { date: data.date, kind: data.kind } });
    const tz = ctx.profile.timezone;
    const from = zonedToUtc(data.date, closed ? 0 : parseTime(data.start!)!, tz);
    const to = zonedToUtc(data.date, closed ? 24 * 60 : parseTime(data.end!)!, tz);
    const [row] = await tx
      .select({ value: count() })
      .from(appointmentPets)
      .where(
        and(
          eq(appointmentPets.organizationId, ctx.organization.id),
          lt(appointmentPets.startsAt, to),
          gt(appointmentPets.endsAt, from),
          notInArray(appointmentPets.status, [...FREE_STATUSES]),
        ),
      );
    return row?.value ?? 0;
  });
  revalidatePath("/app", "layout");
  return ok(
    booked > 0
      ? `Dia especial salvo. Atenção: já há ${booked} ${booked === 1 ? "pet agendado" : "pets agendados"} nesse período.`
      : "Dia especial salvo",
  );
}

export async function removeCapacityExceptionAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("schedule.edit");
  if ("error" in ctx) return fail(ctx.error);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Dia especial não encontrado.");
  await inShop(ctx, (tx) =>
    tx
      .delete(capacityExceptions)
      .where(
        and(
          eq(capacityExceptions.id, id.data),
          eq(capacityExceptions.organizationId, ctx.organization.id),
        ),
      ),
  );
  revalidatePath("/app", "layout");
  return ok("Dia especial removido");
}
