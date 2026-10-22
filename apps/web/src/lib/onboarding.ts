import "server-only";
import { eq, sql } from "drizzle-orm";
import { ONBOARDING_STEPS, shopProfiles, type OnboardingStep, type Transaction } from "@petshop/db";

export interface StepInfo {
  key: OnboardingStep;
  title: string;
  summary: string;
  /** Pode seguir sem concluir (fica pendente no checklist do início). */
  optional: boolean;
}

export const STEPS: StepInfo[] = [
  {
    key: "dados",
    title: "Dados do pet shop",
    summary: "Nome, documento, endereço e contato",
    optional: false,
  },
  {
    key: "horarios",
    title: "Horários e vagas",
    summary: "Quando abre e quantos pets atende por horário",
    optional: false,
  },
  {
    key: "servicos",
    title: "Serviços e preços",
    summary: "O que vocês fazem, quanto custa e quanto demora por porte",
    optional: false,
  },
  { key: "pix", title: "PIX", summary: "Sua chave para receber dos clientes", optional: false },
  {
    key: "whatsapp",
    title: "WhatsApp",
    summary: "Conectar o número do pet shop para avisar os clientes",
    optional: true,
  },
  { key: "equipe", title: "Equipe", summary: "Convidar quem trabalha com você", optional: true },
];

export const STEP_KEYS = STEPS.map((step) => step.key);

export function isStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function nextStep(current: OnboardingStep): OnboardingStep | null {
  const index = STEP_KEYS.indexOf(current);
  return STEP_KEYS[index + 1] ?? null;
}

export function firstPendingStep(
  done: Partial<Record<OnboardingStep, string>>,
): OnboardingStep | null {
  return STEP_KEYS.find((key) => !done[key]) ?? null;
}

/** Marca uma etapa como concluída (idempotente). */
export async function completeStep(
  tx: Transaction,
  organizationId: string,
  step: OnboardingStep,
): Promise<void> {
  await tx
    .update(shopProfiles)
    .set({
      onboarding: sql`${shopProfiles.onboarding} || jsonb_build_object(${step}::text, coalesce(${shopProfiles.onboarding} ->> ${step}::text, now()::text))`,
    })
    .where(eq(shopProfiles.organizationId, organizationId));
}
