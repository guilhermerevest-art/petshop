"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { acceptInvitationAction, acceptInvitationWithSignUpAction } from "@/server/invite-actions";

export function AcceptInvitationButton({ invitationId, organizationName }: { invitationId: string; organizationName: string }) {
  const [state, action] = useActionState(acceptInvitationAction, null);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <ActionFeedback state={state} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton size="lg" pendingLabel="Entrando na equipe…">
        Entrar na equipe do {organizationName}
      </SubmitButton>
    </ActionForm>
  );
}

export function InvitationSignUpForm({ invitationId, email }: { invitationId: string; email: string }) {
  const [state, action] = useActionState(acceptInvitationWithSignUpAction, null);
  return (
    <ActionForm action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <Field label="E-mail" hint="O convite foi enviado para este e-mail.">
        {(props) => <Input {...props} value={email} readOnly disabled />}
      </Field>
      <Field label="Seu nome" error={fieldError(state, "name")}>
        {(props) => <Input {...props} name="name" autoComplete="name" required />}
      </Field>
      <Field label="Seu celular com WhatsApp" error={fieldError(state, "phone")}>
        {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(19) 98765-4321" required />}
      </Field>
      <Field label="Crie uma senha" error={fieldError(state, "password")} hint="Pelo menos 8 caracteres.">
        {(props) => <Input {...props} name="password" type="password" autoComplete="new-password" minLength={8} required />}
      </Field>
      <SubmitButton size="lg" pendingLabel="Criando sua conta…">Criar conta e entrar na equipe</SubmitButton>
    </ActionForm>
  );
}
