import { describe, expect, it } from "vitest";
import {
  addDays,
  formatLocalDate,
  isLocalDate,
  todayIn,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from "../src/zoned";
import { fitsAt, slotsForDay } from "../src/capacity";

describe("datas no fuso do pet shop", () => {
  it("converte hora local de São Paulo (UTC−3) para UTC e de volta", () => {
    const utc = zonedToUtc("2026-10-22", 9 * 60, "America/Sao_Paulo");
    expect(utc.toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(utcToZoned(utc, "America/Sao_Paulo")).toEqual({ date: "2026-10-22", minutes: 540 });
  });

  it("respeita outros fusos do Brasil", () => {
    expect(zonedToUtc("2026-10-22", 9 * 60, "America/Manaus").toISOString()).toBe(
      "2026-10-22T13:00:00.000Z",
    );
    expect(zonedToUtc("2026-10-22", 9 * 60, "America/Rio_Branco").toISOString()).toBe(
      "2026-10-22T14:00:00.000Z",
    );
    expect(zonedToUtc("2026-10-22", 9 * 60, "America/Noronha").toISOString()).toBe(
      "2026-10-22T11:00:00.000Z",
    );
  });

  it("acerta a virada do dia", () => {
    // 23h de 22/10 em São Paulo já é 23/10 em UTC
    const utc = zonedToUtc("2026-10-22", 23 * 60, "America/Sao_Paulo");
    expect(utc.toISOString()).toBe("2026-10-23T02:00:00.000Z");
    expect(todayIn("America/Sao_Paulo", utc)).toBe("2026-10-22");
  });

  it("calcula dias e dias da semana", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(weekdayOf("2026-10-22")).toBe(4);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(formatLocalDate("2026-10-22")).toBe("quinta-feira, 22 de outubro");
  });

  it("confere se um atendimento cabe num horário", () => {
    const slots = slotsForDay(
      [{ weekday: 4, start: "08:00", end: "12:00", intervalMinutes: 60, slots: 1 }],
      4,
    );
    expect(fitsAt(slots, [], 9 * 60, 120)).toBe(true);
    expect(fitsAt(slots, [{ start: 600, end: 660 }], 9 * 60, 120)).toBe(false);
    expect(fitsAt(slots, [], 11 * 60, 120)).toBe(false);
  });
});
