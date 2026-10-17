import { describe, expect, it } from "vitest";
import {
  availableStarts,
  describeDay,
  occupancy,
  slotsForDay,
  validateCapacityRules,
  weeklyCapacity,
  type CapacityRule,
} from "../src/capacity";
import { parseTime } from "../src/time";

const t = (value: string) => parseTime(value)!;

const rules: CapacityRule[] = [
  { weekday: 1, start: "08:00", end: "12:00", intervalMinutes: 60, slots: 3 },
  { weekday: 1, start: "13:00", end: "18:00", intervalMinutes: 60, slots: 2 },
];

describe("grade de vagas", () => {
  it("gera os horários do dia", () => {
    const slots = slotsForDay(rules, 1);
    expect(slots.map((s) => s.start)).toEqual(
      ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map(t),
    );
    expect(slots[0]!.capacity).toBe(3);
    expect(slots[4]!.capacity).toBe(2);
    expect(slotsForDay(rules, 0)).toEqual([]);
  });

  it("aplica exceções da data", () => {
    expect(slotsForDay(rules, 1, [{ slots: 0 }])).toEqual([]);
    const reduced = slotsForDay(rules, 1, [{ start: "13:00", end: "18:00", slots: 1 }]);
    expect(reduced.filter((s) => s.start >= t("13:00")).every((s) => s.capacity === 1)).toBe(true);
    expect(reduced[0]!.capacity).toBe(3);
  });

  it("um pet ocupa todos os horários que o atendimento cobre", () => {
    const slots = slotsForDay(rules, 1);
    const used = occupancy(slots, [
      { start: t("09:00"), end: t("10:00") },
      { start: t("09:00"), end: t("11:00") },
    ]);
    expect(used.slice(0, 4)).toEqual([0, 2, 1, 0]);
  });

  it("arredonda para cima: 1h30 às 9h ocupa 9h e 10h", () => {
    const slots = slotsForDay(rules, 1);
    const used = occupancy(slots, [{ start: t("09:00"), end: t("10:30") }]);
    expect(used.slice(0, 4)).toEqual([0, 1, 1, 0]);
  });

  it("só oferece horários com vaga durante toda a duração", () => {
    const slots = slotsForDay(rules, 1);
    const bookings = [
      { start: t("10:00"), end: t("11:00") },
      { start: t("10:00"), end: t("11:00") },
      { start: t("10:00"), end: t("11:00") },
    ];
    const starts = availableStarts(slots, bookings, 120);
    // 9h precisaria de 10h (lotado); 11h atravessaria o almoço; 17h passaria do fechamento
    expect(starts).toEqual(["08:00", "13:00", "14:00", "15:00", "16:00"].map(t));
  });

  it("valida sobreposição e horários", () => {
    const issues = validateCapacityRules([
      ...rules,
      { weekday: 1, start: "11:00", end: "14:00", intervalMinutes: 60, slots: 1 },
      { weekday: 2, start: "10:00", end: "09:00", intervalMinutes: 60, slots: 1 },
    ]);
    expect([...new Set(issues.map((i) => i.index))].sort()).toEqual([1, 2, 3]);
  });

  it("resume a semana", () => {
    expect(weeklyCapacity(rules)).toBe(4 * 3 + 5 * 2);
    expect(describeDay(rules, 1)).toBe("08:00 às 12:00 e 13:00 às 18:00");
    expect(describeDay(rules, 0)).toBe("Fechado");
  });
});
