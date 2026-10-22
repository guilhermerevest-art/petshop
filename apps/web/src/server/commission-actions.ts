"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { memberCommissions } from "@petshop/db";
import { audit } from "@/lib/audit";
import { listStaff } from "@/lib/sales";
import { fail, inShop, ok, shopForAction, type ActionResult } from "@/lib/shop";

/** Percentual de cada pessoa (0 = sem comissão). Vale para as comandas pagas daqui em diante. */
export async function saveCommissionsAction(
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await shopForAction("commissions.manage");
  if ("error" in ctx) return fail(ctx.error);
  const staff = await listStaff(ctx);
  const values: { userId: string; percent: number }[] = [];
  const errors: Record<string, string> = {};
  for (const person of staff) {
    const raw = String(formData.get(`percent.${person.id}`) ?? "")
      .trim()
      .replace(",", ".");
    const percent = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      errors[`percent.${person.id}`] = "De 0 a 100.";
      continue;
    }
    values.push({ userId: person.id, percent: Math.round(percent * 100) / 100 });
  }
  if (Object.keys(errors).length) return fail("Confira os percentuais.", errors);
  await inShop(ctx, async (tx) => {
    for (const { userId, percent } of values) {
      if (percent === 0) {
        await tx
          .delete(memberCommissions)
          .where(
            and(
              eq(memberCommissions.organizationId, ctx.organization.id),
              eq(memberCommissions.userId, userId),
            ),
          );
      } else {
        await tx
          .insert(memberCommissions)
          .values({ organizationId: ctx.organization.id, userId, percent })
          .onConflictDoUpdate({
            target: [memberCommissions.organizationId, memberCommissions.userId],
            set: { percent },
          });
      }
    }
    await audit(tx, ctx, "comissoes.alteradas", { data: values });
  });
  revalidatePath("/app", "layout");
  return ok("Comissões salvas. Valem para as próximas comandas pagas.");
}
