"use client";

import { useState } from "react";
import { formatBRL, parseBRL } from "@petshop/core";
import { fieldError } from "@/components/action-feedback";
import { useImmediateAction } from "@/components/use-immediate-action";
import { Notice } from "@/components/ui/notice";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { closeCashAction, openCashAction } from "@/server/sales-actions";

export function OpenCashForm() {
  const [state, action] = useImmediateAction(openCashAction);
  return (
    <ActionForm action={action} className="flex flex-col gap-4" noValidate>
      {state && !state.ok ? <Notice tone="error">{state.message}</Notice> : null}
      <Field label="Troco na gaveta (R$)" hint="Dinheiro que já está no caixa ao abrir.">
        {(props) => (
          <Input
            {...props}
            name="opening"
            inputMode="decimal"
            placeholder="0,00"
            className="max-w-40 tabular"
          />
        )}
      </Field>
      <div>
        <SubmitButton size="lg" pendingLabel="Abrindo…">
          Abrir caixa
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CloseCashForm({ expectedCents }: { expectedCents: number }) {
  const [state, action] = useImmediateAction(closeCashAction);
  const [counted, setCounted] = useState("");
  const countedCents = parseBRL(counted);
  const diff = countedCents === null ? null : countedCents - expectedCents;
  return (
    <ActionForm action={action} className="flex flex-col gap-4" noValidate>
      {state && !state.ok ? <Notice tone="error">{state.message}</Notice> : null}
      <Field
        label="Dinheiro contado na gaveta (R$)"
        error={fieldError(state, "counted")}
        hint={`Esperado: ${formatBRL(expectedCents)}`}
      >
        {(props) => (
          <Input
            {...props}
            name="counted"
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0,00"
            className="max-w-40 tabular"
          />
        )}
      </Field>
      {diff !== null ? (
        <p
          className={
            diff === 0
              ? "rounded-campo bg-azulejo-claro px-4 py-3 font-medium"
              : "rounded-campo bg-patinho-claro px-4 py-3 font-medium"
          }
        >
          {diff === 0
            ? "Bateu certinho."
            : `${diff > 0 ? "Sobra" : "Falta"} de ${formatBRL(Math.abs(diff))}.`}
        </p>
      ) : null}
      <Field label="Observação" optional>
        {(props) => (
          <Textarea {...props} name="notes" rows={2} className="min-h-0" maxLength={300} />
        )}
      </Field>
      <div>
        <SubmitButton size="lg" pendingLabel="Fechando…">
          Fechar caixa
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
