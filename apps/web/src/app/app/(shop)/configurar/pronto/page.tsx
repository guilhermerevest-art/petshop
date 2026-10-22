import type { Metadata } from "next";
import Link from "next/link";
import { WizardSteps } from "@/components/settings/wizard-steps";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { firstPendingStep, STEPS } from "@/lib/onboarding";
import { requireShop } from "@/lib/shop";

export const metadata: Metadata = { title: "Configuração concluída" };

export default async function SetupDonePage() {
  const ctx = await requireShop({ capability: "shop.edit" });
  const pending = STEPS.filter((step) => !ctx.profile.onboarding[step.key]);
  const nextPending = firstPendingStep(ctx.profile.onboarding);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-10 lg:self-start">
        <p className="mb-3 px-3 text-sm text-tinta-suave">Configuração do pet shop</p>
        <WizardSteps current={null} done={ctx.profile.onboarding} />
      </aside>
      <div className="max-w-2xl">
        <h1 className="text-[32px]">{pending.length === 0 ? "Tudo pronto!" : "Quase lá"}</h1>
        <p className="mt-3 text-tinta-suave">
          {pending.length === 0
            ? `O ${ctx.organization.name} está configurado. Você pode mudar qualquer coisa depois, pelo menu.`
            : "O essencial está configurado. Falta pouco para aproveitar tudo:"}
        </p>
        {pending.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {pending.map((step) => (
              <li key={step.key}>
                <Link
                  href={`/app/configurar/${step.key}`}
                  className="font-medium text-azulejo underline underline-offset-2"
                >
                  {step.title}
                </Link>
                <span className="text-tinta-suave">: {step.summary.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Notice className="mt-8" title="O que vem a seguir">
          A agenda do dia, o cadastro de clientes e pets, o checklist dos atendimentos e as vendas
          chegam nas próximas atualizações, já usando os horários, serviços e o WhatsApp que você
          configurou.
        </Notice>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app" className={buttonClasses({ size: "lg" })}>
            Ir para o início
          </Link>
          {nextPending ? (
            <Link
              href={`/app/configurar/${nextPending}`}
              className={buttonClasses({ size: "lg", variant: "secondary" })}
            >
              Continuar configurando
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
