"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState, useMemo, useState } from "react";
import { Copy, Minus, Plus, Trash2 } from "lucide-react";
import {
  parseTime,
  validateCapacityRules,
  WEEKDAY_LABELS,
  weeklyCapacity,
  type CapacityRule,
  type Weekday,
} from "@petshop/core";
import { ActionFeedback } from "@/components/action-feedback";
import { Button } from "@/components/ui/button";
import { ChoiceCards, Switch } from "@/components/ui/choice";
import { inputClasses } from "@/components/ui/field";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { WeekGrid } from "@/components/week-grid";
import { cn } from "@/lib/cn";
import { saveCapacityAction } from "@/server/settings-actions";

type Range = { start: string; end: string; slots: number };
type Day = { open: boolean; ranges: Range[] };

const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_RANGE: Range = { start: "08:00", end: "18:00", slots: 2 };

function fromRules(rules: CapacityRule[]): { interval: number; days: Record<Weekday, Day> } {
  const days = Object.fromEntries(
    ORDER.map((d) => [d, { open: false, ranges: [] as Range[] }]),
  ) as Record<Weekday, Day>;
  for (const rule of [...rules].sort(
    (a, b) => (parseTime(a.start) ?? 0) - (parseTime(b.start) ?? 0),
  )) {
    days[rule.weekday].open = true;
    days[rule.weekday].ranges.push({ start: rule.start, end: rule.end, slots: rule.slots });
  }
  return { interval: rules[0]?.intervalMinutes ?? 60, days };
}

function toRules(days: Record<Weekday, Day>, interval: number): CapacityRule[] {
  return ORDER.flatMap((weekday) =>
    days[weekday].open
      ? days[weekday].ranges.map((range) => ({
          weekday,
          start: range.start,
          end: range.end,
          intervalMinutes: interval,
          slots: range.slots,
        }))
      : [],
  );
}

function SlotStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Button
        variant="secondary"
        className="size-11 px-0"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Menos uma vaga"
        disabled={value <= 1}
      >
        <Minus className="size-4" aria-hidden />
      </Button>
      <span className="w-10 text-center text-lg font-medium tabular" aria-live="polite">
        {value}
      </span>
      <Button
        variant="secondary"
        className="size-11 px-0"
        onClick={() => onChange(Math.min(50, value + 1))}
        aria-label="Mais uma vaga"
        disabled={value >= 50}
      >
        <Plus className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function CapacityEditor({
  initialRules,
  wizard,
}: {
  initialRules: CapacityRule[];
  wizard: boolean;
}) {
  const initial = useMemo(() => fromRules(initialRules), [initialRules]);
  const [interval, setIntervalMinutes] = useState<number>(initial.interval);
  const [days, setDays] = useState<Record<Weekday, Day>>(initial.days);
  const [state, action] = useActionState(saveCapacityAction, null);

  const rules = toRules(days, interval);
  const issues = validateCapacityRules(rules);
  const total = weeklyCapacity(rules);

  const update = (weekday: Weekday, change: (day: Day) => Day) =>
    setDays((current) => ({ ...current, [weekday]: change(current[weekday]) }));

  const copyToOthers = (source: Weekday) => {
    const ranges = days[source].ranges;
    setDays((current) => {
      const next = { ...current };
      for (const weekday of ORDER) {
        const weekdayIsWorkday = weekday >= 1 && weekday <= 5;
        const sourceIsWorkday = source >= 1 && source <= 5;
        if (weekday !== source && weekdayIsWorkday === sourceIsWorkday && current[weekday].open) {
          next[weekday] = { open: true, ranges: ranges.map((r) => ({ ...r })) };
        }
      }
      return next;
    });
  };

  // Índice de cada faixa na lista de regras, para apontar erros na linha certa.
  let ruleIndex = 0;

  return (
    <ActionForm action={action} className="flex flex-col gap-6">
      {wizard ? <input type="hidden" name="wizard" value="1" /> : null}
      <input type="hidden" name="rules" value={JSON.stringify(rules)} />
      <ActionFeedback state={state} />

      <Panel>
        <PanelSection>
          <ChoiceCards
            name="interval"
            legend="De quanto em quanto tempo começa um horário?"
            value={String(interval)}
            onChange={(value) => setIntervalMinutes(Number(value))}
            options={[
              { value: "60", label: "A cada 1 hora", description: "8:00, 9:00, 10:00…" },
              { value: "30", label: "A cada 30 minutos", description: "8:00, 8:30, 9:00…" },
            ]}
          />
        </PanelSection>
        {ORDER.map((weekday) => {
          const day = days[weekday];
          return (
            <PanelSection key={weekday} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Switch
                  checked={day.open}
                  onChange={(open) =>
                    update(weekday, (d) => ({
                      open,
                      ranges: open && d.ranges.length === 0 ? [{ ...DEFAULT_RANGE }] : d.ranges,
                    }))
                  }
                  label={<span className="font-medium">{WEEKDAY_LABELS[weekday]}</span>}
                />
                {!day.open ? <span className="text-[15px] text-tinta-suave">Fechado</span> : null}
                {day.open && (weekday === 1 || weekday === 6) ? (
                  <Button variant="ghost" size="sm" onClick={() => copyToOthers(weekday)}>
                    <Copy className="size-4" aria-hidden />
                    {weekday === 1
                      ? "Repetir nos outros dias úteis abertos"
                      : "Repetir no domingo, se aberto"}
                  </Button>
                ) : null}
              </div>
              {day.open
                ? day.ranges.map((range, index) => {
                    const myIndex = ruleIndex++;
                    const issue = issues.find((i) => i.index === myIndex);
                    return (
                      <div key={index} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm text-tinta-suave">Das</span>
                            <input
                              type="time"
                              step={900}
                              value={range.start}
                              onChange={(e) =>
                                update(weekday, (d) => ({
                                  ...d,
                                  ranges: d.ranges.map((r, i) =>
                                    i === index ? { ...r, start: e.target.value } : r,
                                  ),
                                }))
                              }
                              className={cn(inputClasses, "w-[136px] tabular")}
                              aria-invalid={issue ? true : undefined}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm text-tinta-suave">Até</span>
                            <input
                              type="time"
                              step={900}
                              value={range.end}
                              onChange={(e) =>
                                update(weekday, (d) => ({
                                  ...d,
                                  ranges: d.ranges.map((r, i) =>
                                    i === index ? { ...r, end: e.target.value } : r,
                                  ),
                                }))
                              }
                              className={cn(inputClasses, "w-[136px] tabular")}
                              aria-invalid={issue ? true : undefined}
                            />
                          </label>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm text-tinta-suave">Pets por horário</span>
                            <SlotStepper
                              label={`Vagas por horário, ${WEEKDAY_LABELS[weekday]}`}
                              value={range.slots}
                              onChange={(slots) =>
                                update(weekday, (d) => ({
                                  ...d,
                                  ranges: d.ranges.map((r, i) =>
                                    i === index ? { ...r, slots } : r,
                                  ),
                                }))
                              }
                            />
                          </div>
                          {day.ranges.length > 1 ? (
                            <Button
                              variant="ghost"
                              className="size-11 px-0"
                              aria-label="Remover esta faixa"
                              onClick={() =>
                                update(weekday, (d) => ({
                                  ...d,
                                  ranges: d.ranges.filter((_, i) => i !== index),
                                }))
                              }
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                        {issue ? (
                          <p className="text-sm font-medium text-alerta">{issue.message}</p>
                        ) : null}
                      </div>
                    );
                  })
                : null}
              {day.open ? (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update(weekday, (d) => {
                        const last = d.ranges[d.ranges.length - 1];
                        return {
                          ...d,
                          ranges: [
                            ...d.ranges,
                            { start: last?.end ?? "13:00", end: "18:00", slots: last?.slots ?? 2 },
                          ],
                        };
                      })
                    }
                  >
                    <Plus className="size-4" aria-hidden /> Adicionar faixa (ex.: depois do almoço)
                  </Button>
                </div>
              ) : null}
            </PanelSection>
          );
        })}
      </Panel>

      <section aria-labelledby="previa-semana" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="previa-semana" className="text-lg">
            Sua semana
          </h2>
          <p className="text-tinta-suave tabular">{total} vagas por semana</p>
        </div>
        <WeekGrid rules={rules} />
        <p className="text-sm text-tinta-suave">
          Cada quadradinho é uma vaga. Um serviço que dura mais que um horário ocupa a vaga em todos
          os horários que ele cobre.
        </p>
      </section>

      <div>
        <SubmitButton
          size="lg"
          pendingLabel="Salvando…"
          disabled={issues.length > 0 || rules.length === 0}
        >
          {wizard ? "Salvar e continuar" : "Salvar horários"}
        </SubmitButton>
        {issues.length > 0 ? (
          <p className="mt-2 text-sm text-alerta">Corrija os horários destacados para salvar.</p>
        ) : null}
      </div>
    </ActionForm>
  );
}
