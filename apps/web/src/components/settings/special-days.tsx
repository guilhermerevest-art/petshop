"use client";

import { useActionState, useState } from "react";
import { formatLocalDate } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { capitalize } from "@/lib/format";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  addCapacityExceptionAction,
  removeCapacityExceptionAction,
} from "@/server/exception-actions";

export interface SpecialDay {
  id: string;
  date: string;
  start: string | null;
  end: string | null;
  slots: number;
  reason: string | null;
}

/** Feriados, folgas e dias com menos (ou mais) vagas que o normal. */
export function SpecialDays({ days, today }: { days: SpecialDay[]; today: string }) {
  const [state, action] = useActionState(addCapacityExceptionAction, null);
  const [kind, setKind] = useState<"fechado" | "vagas">("fechado");
  return (
    <Panel>
      <PanelSection className="flex flex-col gap-1">
        <h2 className="text-xl">Dias especiais</h2>
        <p className="text-tinta-suave">
          Feriados, folgas ou dias com vagas diferentes. Valem só para a data escolhida.
        </p>
      </PanelSection>
      {days.length > 0 ? (
        <PanelSection>
          <ul className="flex flex-col gap-2">
            {days.map((day) => (
              <li
                key={day.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-campo bg-espuma px-4 py-3"
              >
                <span>
                  <span className="font-medium">{capitalize(formatLocalDate(day.date))}</span>
                  <span className="block text-[15px] text-tinta-suave">
                    {day.start === null
                      ? "Fechado o dia todo"
                      : `${day.start} às ${day.end}: ${day.slots === 0 ? "fechado" : `${day.slots} ${day.slots === 1 ? "vaga" : "vagas"} por horário`}`}
                    {day.reason ? ` · ${day.reason}` : ""}
                  </span>
                </span>
                <ActionButton
                  action={removeCapacityExceptionAction}
                  hidden={{ id: day.id }}
                  variant="ghost"
                  size="sm"
                  pendingLabel="Removendo…"
                >
                  Remover
                </ActionButton>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}
      <PanelSection>
        <ActionForm action={action} className="flex flex-col gap-5" noValidate>
          <ActionFeedback state={state} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Data" error={fieldError(state, "date")}>
              {(props) => (
                <Input {...props} type="date" name="date" min={today} className="tabular" />
              )}
            </Field>
            <Field label="Motivo" optional>
              {(props) => (
                <Input {...props} name="reason" placeholder="Ex.: feriado" maxLength={80} />
              )}
            </Field>
          </div>
          <ChoiceCards
            name="kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: "fechado", label: "Fechado o dia todo" },
              { value: "vagas", label: "Vagas diferentes num horário" },
            ]}
          />
          {kind === "vagas" ? (
            <div className="grid grid-cols-3 gap-3 sm:max-w-md">
              <Field label="Das" error={fieldError(state, "start")}>
                {(props) => (
                  <Input {...props} type="time" name="start" step={900} className="tabular" />
                )}
              </Field>
              <Field label="Até" error={fieldError(state, "end")}>
                {(props) => (
                  <Input {...props} type="time" name="end" step={900} className="tabular" />
                )}
              </Field>
              <Field label="Vagas" error={fieldError(state, "slots")}>
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    name="slots"
                    min={0}
                    max={50}
                    inputMode="numeric"
                  />
                )}
              </Field>
            </div>
          ) : null}
          <div>
            <SubmitButton variant="secondary" pendingLabel="Salvando…">
              Adicionar dia especial
            </SubmitButton>
          </div>
        </ActionForm>
      </PanelSection>
    </Panel>
  );
}
