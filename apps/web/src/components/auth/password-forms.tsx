"use client";

import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordResetAction, resetPasswordAction } from "@/server/auth-actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <Field label="E-mail da conta" error={fieldError(state, "email")}>
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" required />}
      </Field>
      <SubmitButton size="lg" pendingLabel="Enviando…">Enviar link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" error={fieldError(state, "password")} hint="Pelo menos 8 caracteres.">
        {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <SubmitButton size="lg" pendingLabel="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}
