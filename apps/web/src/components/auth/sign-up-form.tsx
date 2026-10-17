"use client";

import { ActionForm } from "@/components/ui/action-form";

import Link from "next/link";
import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Checkbox } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUpAction } from "@/server/auth-actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, null);
  return (
    <ActionForm action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <Field label="Nome do pet shop" error={fieldError(state, "shopName")} hint="Como os clientes conhecem vocês.">
        {(props) => <Input {...props} name="shopName" autoComplete="organization" required />}
      </Field>
      <Field label="Seu nome" error={fieldError(state, "name")}>
        {(props) => <Input {...props} name="name" autoComplete="name" required />}
      </Field>
      <Field label="Seu celular com WhatsApp" error={fieldError(state, "phone")} hint="Para avisos importantes sobre a conta.">
        {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(19) 98765-4321" required />}
      </Field>
      <Field label="E-mail" error={fieldError(state, "email")} hint="Você vai usar para entrar.">
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Field label="Senha" error={fieldError(state, "password")} hint="Pelo menos 8 caracteres.">
        {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <Checkbox
          name="terms"
          required
          label={
            <>
              Li e aceito os <Link href="/termos" className="font-medium text-azulejo underline underline-offset-2">termos de uso</Link> e a{" "}
              <Link href="/privacidade" className="font-medium text-azulejo underline underline-offset-2">política de privacidade</Link>.
            </>
          }
        />
        {fieldError(state, "terms") ? <p className="text-sm font-medium text-alerta">{fieldError(state, "terms")}</p> : null}
      </div>
      <SubmitButton size="lg" pendingLabel="Criando sua conta…">Criar conta</SubmitButton>
    </ActionForm>
  );
}
