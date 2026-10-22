import type { Weekday } from "./time";

/** Datas da agenda no fuso do pet shop. A data local é sempre "AAAA-MM-DD"; horários em minutos. */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function parts(date: Date, timeZone: string) {
  const values: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return values as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** Diferença (ms) entre a hora local do fuso e o UTC num instante. */
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function splitDate(localDate: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new Error(`Data inválida: ${localDate}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = splitDate(value);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Instante (UTC) correspondente a "data local + minutos" no fuso informado. */
export function zonedToUtc(localDate: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = splitDate(localDate);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let result = guess - offsetMs(new Date(guess), timeZone);
  // Ajuste para horário de verão: confere o deslocamento no instante encontrado.
  const corrected = guess - offsetMs(new Date(result), timeZone);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/** Data local e minutos desde a meia-noite de um instante, no fuso informado. */
export function utcToZoned(date: Date, timeZone: string): { date: string; minutes: number } {
  const p = parts(date, timeZone);
  const local = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { date: local, minutes: p.hour * 60 + p.minute };
}

export function todayIn(timeZone: string, now = new Date()): string {
  return utcToZoned(now, timeZone).date;
}

export function addDays(localDate: string, days: number): string {
  const [y, m, d] = splitDate(localDate);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function weekdayOf(localDate: string): Weekday {
  const [y, m, d] = splitDate(localDate);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() as Weekday;
}

const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "quarta-feira, 22 de outubro" */
export function formatLocalDate(localDate: string): string {
  const [y, m, d] = splitDate(localDate);
  return longDate.format(new Date(Date.UTC(y, m - 1, d, 12)));
}
