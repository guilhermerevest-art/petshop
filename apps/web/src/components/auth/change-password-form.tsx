"use client";

import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { changePasswordAction } from "@/server/auth-actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <ActionForm
      key={state?.ok ? "trocada" : "senha"}
      action={action}
      className="flex flex-col gap-5"
      noValidate
    >
      <ActionFeedback state={state} />
      <Field label="Senha atual" error={fieldError(state, "currentPassword")}>
        {(props) => (
          <Input
            {...props}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
          />
        )}
      </Field>
      <Field
        label="Nova senha"
        hint="Pelo menos 8 caracteres. Você continua conectado só neste aparelho."
        error={fieldError(state, "newPassword")}
      >
        {(props) => (
          <Input {...props} name="newPassword" type="password" autoComplete="new-password" />
        )}
      </Field>
      <div>
        <SubmitButton pendingLabel="Salvando…">Trocar senha</SubmitButton>
      </div>
    </ActionForm>
  );
}
