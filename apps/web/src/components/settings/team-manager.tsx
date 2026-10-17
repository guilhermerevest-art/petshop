"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState, useState } from "react";
import { formatBrPhone } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { ChoiceCards } from "@/components/ui/choice";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { INVITABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/server/settings-actions";

export interface MemberItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isYou: boolean;
}

export interface InvitationItem {
  id: string;
  email: string;
  role: Role;
  link: string;
  expiresAt: string;
}

export function TeamManager({
  members,
  invitations,
  canManage,
  whatsappConnected,
}: {
  members: MemberItem[];
  invitations: InvitationItem[];
  canManage: boolean;
  whatsappConnected: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {canManage ? <InviteForm whatsappConnected={whatsappConnected} /> : null}
      <section aria-labelledby="equipe-atual">
        <h2 id="equipe-atual" className="text-lg">
          Quem já está na equipe
        </h2>
        <ul className="mt-3 overflow-hidden rounded-painel border border-rejunte bg-rejunte">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-white px-5 py-4 [&:not(:first-child)]:mt-px">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {member.name} {member.isYou ? <span className="font-normal text-tinta-suave">(você)</span> : null}
                </p>
                <p className="truncate text-[15px] text-tinta-suave">
                  {member.email}
                  {member.phone ? `, ${formatBrPhone(member.phone)}` : ""}
                </p>
              </div>
              {canManage && member.role !== "owner" && !member.isYou ? (
                <MemberControls member={member} />
              ) : (
                <Badge tone={member.role === "owner" ? "ok" : "neutral"}>{ROLE_LABELS[member.role]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>
      {invitations.length > 0 ? (
        <section aria-labelledby="convites-pendentes">
          <h2 id="convites-pendentes" className="text-lg">
            Convites aguardando resposta
          </h2>
          <ul className="mt-3 overflow-hidden rounded-painel border border-rejunte bg-rejunte">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-white px-5 py-4 [&:not(:first-child)]:mt-px">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-[15px] text-tinta-suave">{ROLE_LABELS[invitation.role]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={invitation.link} label="Copiar link do convite" size="sm" />
                  {canManage ? (
                    <ActionButton action={cancelInvitationAction} hidden={{ invitationId: invitation.id }} variant="ghost" size="sm" pendingLabel="Cancelando…">
                      Cancelar convite
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function InviteForm({ whatsappConnected }: { whatsappConnected: boolean }) {
  const [state, action] = useActionState(inviteMemberAction, null);
  const [role, setRole] = useState<Role>("reception");
  return (
    <Panel>
      {/* Depois de convidar, recria o formulário para limpar os campos. */}
      <ActionForm action={action} key={state?.ok && state.data ? state.data.link : "convite"}>
        <PanelSection className="flex flex-col gap-5">
          <h2 className="text-lg">Convidar uma pessoa</h2>
          <ActionFeedback state={state} />
          {state?.ok && state.data ? (
            <Notice tone="success" title={state.data.sentByWhatsApp ? "Convite enviado pelo WhatsApp." : "Convite criado."}>
              <p>Você também pode mandar o link direto para a pessoa:</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-white px-2 py-1 text-sm break-all">{state.data.link}</code>
                <CopyButton value={state.data.link} size="sm" />
              </div>
            </Notice>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail da pessoa" error={fieldError(state, "email")} hint="Ela usa este e-mail para entrar.">
              {(props) => <Input {...props} name="email" type="email" autoComplete="off" required />}
            </Field>
            <Field
              label="Celular com WhatsApp"
              optional
              error={fieldError(state, "phone")}
              hint={whatsappConnected ? "Enviamos o convite pelo WhatsApp do pet shop." : "Conecte o WhatsApp para enviar o convite por lá."}
            >
              {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" placeholder="(19) 98765-4321" />}
            </Field>
          </div>
          <ChoiceCards
            name="role"
            legend="O que ela vai fazer"
            columns={3}
            value={role}
            onChange={setRole}
            options={INVITABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value], description: ROLE_DESCRIPTIONS[value] }))}
          />
        </PanelSection>
        <PanelSection>
          <SubmitButton size="lg" pendingLabel="Convidando…">
            Enviar convite
          </SubmitButton>
        </PanelSection>
      </ActionForm>
    </Panel>
  );
}

function MemberControls({ member }: { member: MemberItem }) {
  const [roleState, roleAction] = useActionState(updateMemberRoleAction, null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionForm action={roleAction} className="flex items-center gap-2">
        <input type="hidden" name="memberId" value={member.id} />
        <label className="sr-only" htmlFor={`papel-${member.id}`}>
          Papel de {member.name}
        </label>
        <Select
          id={`papel-${member.id}`}
          name="role"
          defaultValue={member.role}
          className="h-10 w-[200px]"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {INVITABLE_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </Select>
        <ActionFeedback state={roleState} />
      </ActionForm>
      <details>
        <summary className="cursor-pointer list-none rounded-campo px-2 py-2 text-sm text-tinta-suave hover:text-alerta [&::-webkit-details-marker]:hidden">
          Remover
        </summary>
        <div className="mt-2">
          <ActionButton action={removeMemberAction} hidden={{ memberId: member.id }} variant="danger" size="sm" pendingLabel="Removendo…">
            Remover {member.name.split(" ")[0]} da equipe
          </ActionButton>
        </div>
      </details>
    </div>
  );
}
