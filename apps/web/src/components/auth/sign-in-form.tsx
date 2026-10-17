"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInAction } from "@/server/auth-actions";

export function SignInForm({ next, email }: { next?: string; email?: string }) {
  const [state, action] = useActionState(signInAction, null);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="E-mail" error={fieldError(state, "email")}>
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" defaultValue={email} required />}
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            Senha
            <Link href="/esqueci-senha" className="text-sm font-normal text-azulejo underline underline-offset-2">
              Esqueci a senha
            </Link>
          </span>
        }
        error={fieldError(state, "password")}
      >
        {(props) => <Input {...props} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <SubmitButton size="lg" pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
