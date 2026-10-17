export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "paused"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

export type AccessMode =
  /** Tudo liberado. */
  | "full"
  /** Tudo liberado, com aviso de pagamento atrasado. */
  | "warning"
  /** Consulta e exportação; sem criar ou alterar nada. */
  | "read_only"
  /** Só a tela de assinatura e a exportação de dados. */
  | "suspended"
  /** Ainda não assinou (ou o checkout não foi concluído). */
  | "needs_subscription";

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  pastDueSince?: Date | null;
  trialEnd?: Date | null;
}

export interface Access {
  mode: AccessMode;
  canUseApp: boolean;
  canWrite: boolean;
  /** Dias até a próxima mudança de modo (para avisos). */
  daysUntilChange?: number;
}

/** Prazos da política de inadimplência (RN-16). */
export const GRACE_DAYS = 7;
export const SUSPEND_AFTER_DAYS = 30;
export const RETENTION_DAYS_AFTER_CANCEL = 90;

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

function access(mode: AccessMode, daysUntilChange?: number): Access {
  return {
    mode,
    canUseApp: mode === "full" || mode === "warning" || mode === "read_only",
    canWrite: mode === "full" || mode === "warning",
    ...(daysUntilChange !== undefined ? { daysUntilChange } : {}),
  };
}

function overdueAccess(since: Date, now: Date, minimum: "warning" | "read_only"): Access {
  const days = daysBetween(since, now);
  if (days >= SUSPEND_AFTER_DAYS) return access("suspended");
  if (days >= GRACE_DAYS || minimum === "read_only") {
    return access("read_only", SUSPEND_AFTER_DAYS - days);
  }
  return access("warning", GRACE_DAYS - days);
}

/** O que o pet shop pode fazer conforme o status da assinatura (RN-16). */
export function accessFor(subscription: SubscriptionSnapshot | null, now = new Date()): Access {
  if (!subscription) return access("needs_subscription");
  switch (subscription.status) {
    case "trialing":
    case "active":
      return access("full");
    case "past_due":
      return overdueAccess(subscription.pastDueSince ?? now, now, "warning");
    case "unpaid":
      return overdueAccess(subscription.pastDueSince ?? now, now, "read_only");
    case "paused":
      return access("read_only");
    case "canceled": {
      const end = subscription.currentPeriodEnd ?? now;
      if (end > now) return access("full", daysBetween(now, end));
      const days = daysBetween(end, now);
      if (days < RETENTION_DAYS_AFTER_CANCEL) {
        return access("read_only", RETENTION_DAYS_AFTER_CANCEL - days);
      }
      return access("suspended");
    }
    case "incomplete":
    case "incomplete_expired":
      return access("needs_subscription");
  }
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  unpaid: "Não paga",
  paused: "Pausada",
  canceled: "Cancelada",
  incomplete: "Pagamento não concluído",
  incomplete_expired: "Pagamento não concluído",
};
