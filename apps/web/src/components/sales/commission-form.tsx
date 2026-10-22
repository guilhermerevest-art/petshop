"use client";

import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveCommissionsAction } from "@/server/commission-actions";

export function CommissionForm({
  people,
}: {
  people: { id: string; name: string; percent: number }[];
}) {
  const [state, action] = useActionState(saveCommissionsAction, null);
  return (
    <ActionForm action={action} className="flex flex-col gap-4" noValidate>
      <ActionFeedback state={state} />
      <ul className="flex flex-col gap-2">
        {people.map((person) => {
          const error = fieldError(state, `percent.${person.id}`);
          return (
            <li key={person.id} className="flex items-center justify-between gap-3">
              <label htmlFor={`pct-${person.id}`} className="font-medium">
                {person.name}
              </label>
              <span className="flex items-center gap-2">
                <Input
                  id={`pct-${person.id}`}
                  name={`percent.${person.id}`}
                  inputMode="decimal"
                  defaultValue={person.percent ? String(person.percent).replace(".", ",") : ""}
                  placeholder="0"
                  aria-invalid={error ? true : undefined}
                  className="w-20 text-right tabular"
                />
                <span className="text-tinta-suave">%</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div>
        <SubmitButton variant="secondary" pendingLabel="Salvando…">
          Salvar comissões
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
