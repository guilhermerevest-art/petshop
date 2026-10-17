import { formatTime, parseTime, type Weekday, WEEKDAYS } from "./time";

/** Uma faixa da grade: em tal dia da semana, das X às Y, um horário a cada N minutos, com V vagas. */
export interface CapacityRule {
  weekday: Weekday;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
  intervalMinutes: number;
  slots: number;
}

/** Exceção para uma data: fecha o dia (slots = 0) ou muda as vagas de uma faixa. */
export interface CapacityException {
  /** "HH:MM"; ausente = o dia inteiro */
  start?: string | null;
  end?: string | null;
  slots: number;
}

export interface Slot {
  /** minutos desde a meia-noite */
  start: number;
  end: number;
  capacity: number;
}

export const INTERVAL_OPTIONS = [15, 30, 60] as const;

export interface RuleIssue {
  index: number;
  message: string;
}

/** Valida as faixas: horários coerentes e sem sobreposição no mesmo dia. */
export function validateCapacityRules(rules: CapacityRule[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  rules.forEach((rule, index) => {
    const start = parseTime(rule.start);
    const end = parseTime(rule.end);
    if (start === null || end === null) {
      issues.push({ index, message: "Horário inválido" });
      return;
    }
    if (end <= start) issues.push({ index, message: "O fim precisa ser depois do início" });
    if (!Number.isInteger(rule.slots) || rule.slots < 1 || rule.slots > 50) {
      issues.push({ index, message: "Vagas devem ser entre 1 e 50" });
    }
    if (!(INTERVAL_OPTIONS as readonly number[]).includes(rule.intervalMinutes)) {
      issues.push({ index, message: "Intervalo deve ser 15, 30 ou 60 minutos" });
    }
    if (end - start < rule.intervalMinutes) {
      issues.push({ index, message: "A faixa é menor que o intervalo entre horários" });
    }
  });

  for (const weekday of WEEKDAYS) {
    const sameDay = rules
      .map((rule, index) => ({ rule, index }))
      .filter(({ rule }) => rule.weekday === weekday)
      .map(({ rule, index }) => ({ index, start: parseTime(rule.start), end: parseTime(rule.end) }))
      .filter((r): r is { index: number; start: number; end: number } => r.start !== null && r.end !== null)
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < sameDay.length; i++) {
      if (sameDay[i]!.start < sameDay[i - 1]!.end) {
        issues.push({ index: sameDay[i]!.index, message: "Esta faixa se sobrepõe a outra do mesmo dia" });
      }
    }
  }
  return issues;
}

/** Horários de um dia da semana, aplicando exceções da data (se houver). */
export function slotsForDay(
  rules: CapacityRule[],
  weekday: Weekday,
  exceptions: CapacityException[] = [],
): Slot[] {
  const slots: Slot[] = [];
  for (const rule of rules.filter((r) => r.weekday === weekday)) {
    const start = parseTime(rule.start);
    const end = parseTime(rule.end);
    if (start === null || end === null) continue;
    for (let t = start; t + rule.intervalMinutes <= end; t += rule.intervalMinutes) {
      slots.push({ start: t, end: t + rule.intervalMinutes, capacity: rule.slots });
    }
  }
  slots.sort((a, b) => a.start - b.start);

  for (const exception of exceptions) {
    const from = exception.start ? parseTime(exception.start) : 0;
    const to = exception.end ? parseTime(exception.end) : 24 * 60;
    if (from === null || to === null) continue;
    for (const slot of slots) {
      if (slot.start >= from && slot.start < to) slot.capacity = exception.slots;
    }
  }
  return slots.filter((slot) => slot.capacity > 0);
}

export interface Booking {
  start: number;
  end: number;
}

/** Quantos pets ocupam cada horário. Um pet ocupa todos os horários que o atendimento cobre. */
export function occupancy(slots: Slot[], bookings: Booking[]): number[] {
  return slots.map(
    (slot) => bookings.filter((b) => b.start < slot.end && b.end > slot.start).length,
  );
}

/**
 * Horários de início em que um atendimento com essa duração cabe:
 * todos os minutos precisam estar dentro da grade e todos os horários cobertos precisam ter vaga.
 */
export function availableStarts(slots: Slot[], bookings: Booking[], durationMinutes: number): number[] {
  const used = occupancy(slots, bookings);
  const result: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const start = slots[i]!.start;
    const end = start + durationMinutes;
    let cursor = start;
    let fits = true;
    for (let j = i; j < slots.length && cursor < end; j++) {
      const slot = slots[j]!;
      if (slot.start !== cursor || used[j]! >= slot.capacity) {
        fits = false;
        break;
      }
      cursor = slot.end;
    }
    if (fits && cursor >= end) result.push(start);
  }
  return result;
}

/** Total de vagas oferecidas na semana (soma de vagas de todos os horários). */
export function weeklyCapacity(rules: CapacityRule[]): number {
  return WEEKDAYS.reduce<number>(
    (total, weekday) => total + slotsForDay(rules, weekday).reduce((sum, s) => sum + s.capacity, 0),
    0,
  );
}

/** Resumo legível de um dia: "08:00 às 12:00 e 13:00 às 18:00". */
export function describeDay(rules: CapacityRule[], weekday: Weekday): string {
  const ranges = rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: parseTime(r.start) ?? 0, end: parseTime(r.end) ?? 0 }))
    .sort((a, b) => a.start - b.start)
    .map((r) => `${formatTime(r.start)} às ${formatTime(r.end)}`);
  if (ranges.length === 0) return "Fechado";
  return ranges.join(" e ");
}

/** Grade sugerida para começar: seg a sex 8h–12h e 13h–18h, sábado 8h–14h, 2 vagas por hora. */
export function defaultCapacityRules(): CapacityRule[] {
  const rules: CapacityRule[] = [];
  for (const weekday of [1, 2, 3, 4, 5] as const) {
    rules.push({ weekday, start: "08:00", end: "12:00", intervalMinutes: 60, slots: 2 });
    rules.push({ weekday, start: "13:00", end: "18:00", intervalMinutes: 60, slots: 2 });
  }
  rules.push({ weekday: 6, start: "08:00", end: "14:00", intervalMinutes: 60, slots: 2 });
  return rules;
}
