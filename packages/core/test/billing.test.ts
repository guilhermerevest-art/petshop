import { describe, expect, it } from "vitest";
import { accessFor } from "../src/billing";

const now = new Date("2026-10-17T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);

describe("acesso conforme a assinatura (RN-16)", () => {
  it("sem assinatura precisa assinar", () => {
    expect(accessFor(null, now)).toMatchObject({ mode: "needs_subscription", canUseApp: false });
    expect(accessFor({ status: "incomplete" }, now).mode).toBe("needs_subscription");
  });

  it("em teste ou ativa libera tudo", () => {
    expect(accessFor({ status: "trialing" }, now)).toMatchObject({ mode: "full", canWrite: true });
    expect(accessFor({ status: "active" }, now)).toMatchObject({ mode: "full", canWrite: true });
  });

  it("atraso: aviso, depois somente leitura, depois suspenso", () => {
    expect(accessFor({ status: "past_due", pastDueSince: daysAgo(2) }, now)).toMatchObject({
      mode: "warning",
      canWrite: true,
      daysUntilChange: 5,
    });
    expect(accessFor({ status: "past_due", pastDueSince: daysAgo(10) }, now)).toMatchObject({
      mode: "read_only",
      canWrite: false,
      canUseApp: true,
    });
    expect(accessFor({ status: "past_due", pastDueSince: daysAgo(31) }, now)).toMatchObject({
      mode: "suspended",
      canUseApp: false,
    });
    expect(accessFor({ status: "unpaid", pastDueSince: daysAgo(1) }, now).mode).toBe("read_only");
  });

  it("cancelada: completo até o fim do período, depois leitura por 90 dias", () => {
    expect(accessFor({ status: "canceled", currentPeriodEnd: inDays(5) }, now).mode).toBe("full");
    expect(accessFor({ status: "canceled", currentPeriodEnd: daysAgo(10) }, now).mode).toBe(
      "read_only",
    );
    expect(accessFor({ status: "canceled", currentPeriodEnd: daysAgo(91) }, now).mode).toBe(
      "suspended",
    );
  });
});
