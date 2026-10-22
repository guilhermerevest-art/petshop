"use client";

import { useActionState, useState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { stockMovementAction } from "@/server/product-actions";

type MovementType = "entrada" | "perda" | "contagem";

export function StockForm({ productId, current }: { productId: string; current: number }) {
  const [state, action] = useActionState(stockMovementAction, null);
  const [type, setType] = useState<MovementType>("entrada");
  return (
    <ActionForm key={current} action={action} className="flex flex-col gap-4" noValidate>
      <ActionFeedback state={state} />
      <input type="hidden" name="productId" value={productId} />
      <ChoiceCards
        name="type"
        value={type}
        onChange={setType}
        columns={3}
        options={[
          { value: "entrada", label: "Entrada", description: "Chegou mercadoria" },
          { value: "perda", label: "Perda", description: "Vencido, quebrado" },
          { value: "contagem", label: "Contagem", description: `Hoje: ${current}` },
        ]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label={type === "contagem" ? "Quantidade contada" : "Quantidade"}
          error={fieldError(state, "quantity")}
        >
          {(props) => (
            <Input {...props} name="quantity" type="number" min={0} inputMode="numeric" />
          )}
        </Field>
        {type === "entrada" ? (
          <Field label="Custo unitário (R$)" optional>
            {(props) => <Input {...props} name="unitCost" inputMode="decimal" placeholder="0,00" />}
          </Field>
        ) : null}
      </div>
      <Field label="Observação" optional>
        {(props) => (
          <Input
            {...props}
            name="note"
            maxLength={200}
            placeholder={type === "entrada" ? "Ex.: NF 1234" : ""}
          />
        )}
      </Field>
      <div>
        <SubmitButton pendingLabel="Salvando…">
          {type === "entrada"
            ? "Registrar entrada"
            : type === "perda"
              ? "Registrar perda"
              : "Ajustar estoque"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
