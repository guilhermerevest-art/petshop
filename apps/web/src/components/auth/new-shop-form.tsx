"use client";

import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createShopAction } from "@/server/auth-actions";

export function NewShopForm() {
  const [state, action] = useActionState(createShopAction, null);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <Field label="Nome do pet shop" error={fieldError(state, "shopName")}>
        {(props) => <Input {...props} name="shopName" autoComplete="organization" required />}
      </Field>
      <SubmitButton size="lg" pendingLabel="Criando…">Criar pet shop</SubmitButton>
    </form>
  );
}
