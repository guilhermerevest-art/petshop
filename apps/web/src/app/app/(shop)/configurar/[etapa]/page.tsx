import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StepContent } from "@/components/settings/step-content";
import { WizardSteps } from "@/components/settings/wizard-steps";
import { isStep, STEPS } from "@/lib/onboarding";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Primeiros passos" };

export default async function SetupStepPage(props: PageProps<"/app/configurar/[etapa]">) {
  const { etapa } = await props.params;
  if (!isStep(etapa)) notFound();
  const ctx = await requireShop({ capability: "shop.edit" });
  const index = STEPS.findIndex((step) => step.key === etapa);
  const step = STEPS[index]!;

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-10 lg:block lg:self-start">
        <p className="mb-3 px-3 text-sm text-tinta-suave">Configuração do pet shop</p>
        <WizardSteps current={step.key} done={ctx.profile.onboarding} />
      </aside>
      <div className="min-w-0">
        <p className="text-sm text-tinta-suave tabular">
          Etapa {index + 1} de {STEPS.length}
        </p>
        <h1 className="mt-1 text-[28px] sm:text-[32px]">{step.title}</h1>
        <p className="mt-2 mb-6 max-w-2xl text-tinta-suave">{step.summary}.</p>
        <StepContent step={step.key} ctx={ctx} wizard />
      </div>
    </div>
  );
}
