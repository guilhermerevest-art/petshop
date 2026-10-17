import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StepContent } from "@/components/settings/step-content";
import { PageHeader } from "@/components/ui/panel";
import { isStep, STEPS } from "@/lib/onboarding";
import type { Capability } from "@/lib/permissions";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Configurações" };

const CAPABILITY: Record<string, Capability | undefined> = {
  dados: "shop.edit",
  horarios: "schedule.edit",
  servicos: undefined,
  pix: "shop.edit",
  whatsapp: "whatsapp.manage",
  equipe: undefined,
};

export default async function SettingsSectionPage(props: PageProps<"/app/configuracoes/[secao]">) {
  const { secao } = await props.params;
  if (!isStep(secao)) notFound();
  const ctx = await requireShop({ capability: CAPABILITY[secao] });
  const step = STEPS.find((s) => s.key === secao)!;
  return (
    <>
      <PageHeader title={step.title} description={`${step.summary}.`} />
      <div className="max-w-3xl">
        <StepContent step={step.key} ctx={ctx} wizard={false} />
      </div>
    </>
  );
}
