import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { todayIn } from "@petshop/core";
import { capacityExceptions } from "@petshop/db";
import { SpecialDays } from "@/components/settings/special-days";
import { StepContent } from "@/components/settings/step-content";
import { PageHeader } from "@/components/ui/panel";
import { isStep, STEPS } from "@/lib/onboarding";
import type { Capability } from "@/lib/permissions";
import { inShop, requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Configurações" };

const CAPABILITY: Record<string, Capability | undefined> = {
  dados: "shop.edit",
  horarios: "schedule.edit",
  servicos: "services.view",
  pix: "shop.edit",
  whatsapp: "whatsapp.manage",
  equipe: "team.manage",
};

export default async function SettingsSectionPage(props: PageProps<"/app/configuracoes/[secao]">) {
  const { secao } = await props.params;
  if (!isStep(secao)) notFound();
  const ctx = await requireShop({ capability: CAPABILITY[secao] });
  const step = STEPS.find((s) => s.key === secao)!;
  const today = todayIn(ctx.profile.timezone);
  const specialDays =
    secao === "horarios"
      ? await inShop(ctx, (tx) =>
          tx
            .select()
            .from(capacityExceptions)
            .where(
              and(
                eq(capacityExceptions.organizationId, ctx.organization.id),
                gte(capacityExceptions.date, today),
              ),
            )
            .orderBy(asc(capacityExceptions.date), asc(capacityExceptions.startTime)),
        )
      : [];
  return (
    <>
      <PageHeader title={step.title} description={`${step.summary}.`} />
      <div className="flex max-w-3xl flex-col gap-8">
        <StepContent step={step.key} ctx={ctx} wizard={false} />
        {secao === "horarios" ? (
          <SpecialDays
            today={today}
            days={specialDays.map((d) => ({
              id: d.id,
              date: d.date,
              start: d.startTime?.slice(0, 5) ?? null,
              end: d.endTime?.slice(0, 5) ?? null,
              slots: d.slots,
              reason: d.reason,
            }))}
          />
        ) : null}
      </div>
    </>
  );
}
