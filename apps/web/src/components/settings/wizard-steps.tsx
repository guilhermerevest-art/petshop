import Link from "next/link";
import { Check } from "lucide-react";
import type { OnboardingStep } from "@petshop/db";
import { cn } from "@/lib/cn";
import { STEPS } from "@/lib/onboarding";

/** Lista de etapas do assistente: é uma sequência de verdade, por isso tem números. */
export function WizardSteps({ current, done }: { current: OnboardingStep | null; done: Partial<Record<OnboardingStep, string>> }) {
  return (
    <nav aria-label="Etapas da configuração">
      <ol className="flex flex-col gap-1">
        {STEPS.map((step, index) => {
          const isDone = Boolean(done[step.key]);
          const isCurrent = step.key === current;
          return (
            <li key={step.key}>
              <Link
                href={`/app/configurar/${step.key}`}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-campo px-3 py-2.5 transition-colors",
                  isCurrent ? "bg-white ring-1 ring-rejunte-forte" : "hover:bg-white/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-azulejo text-sm font-medium tabular",
                    isDone ? "bg-azulejo text-white" : isCurrent ? "bg-patinho text-tinta" : "bg-rejunte text-tinta-suave",
                  )}
                  aria-hidden
                >
                  {isDone ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[15px]", isCurrent ? "font-medium" : "")}>
                    {step.title}
                    {step.optional ? <span className="text-tinta-suave"> (opcional)</span> : null}
                  </span>
                  <span className="sr-only">{isDone ? ", concluída" : isCurrent ? ", etapa atual" : ""}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
