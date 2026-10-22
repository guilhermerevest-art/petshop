"use client";

import { useActionState } from "react";
import { centsToInput } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { setDiscountAction } from "@/server/sales-actions";

export function DiscountForm({
  orderId,
  discountCents,
}: {
  orderId: string;
  discountCents: number;
}) {
  const [state, action] = useActionState(setDiscountAction, null);
  return (
    <ActionForm action={action} className="flex flex-col gap-2" noValidate>
      <ActionFeedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="desconto" className="text-[15px] font-medium">
        Desconto (R$)
      </label>
      <div className="flex gap-2">
        <Input
          id="desconto"
          name="discount"
          inputMode="decimal"
          defaultValue={discountCents ? centsToInput(discountCents) : ""}
          placeholder="0,00"
          aria-invalid={fieldError(state, "discount") ? true : undefined}
          className="max-w-36 tabular"
        />
        <SubmitButton variant="secondary" pendingLabel="Aplicando…" className="h-12">
          Aplicar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
