"use client";

import { useActionState, useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { formatBrPhone } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionButton } from "@/components/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, ChoiceCards } from "@/components/ui/choice";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { INVITABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import { generatePassword, suggestUsername } from "@/lib/usernames";
import {
  createMemberAction,
  removeMemberAction,
  resetMemberPasswordAction,
  updateMemberRoleAction,
  type AccessResult,
} from "@/server/team-actions";

export interface MemberItem {
  id: string;
  name: string;
  /** Usuário de login (equipe) ou e-mail (dono). */
  login: string;
  phone: string | null;
  role: Role;
  isYou: boolean;
}

export function TeamManager({
  members,
  canManage,
  whatsappConnected,
  shopSlug,
}: {
  members: MemberItem[];
  canManage: boolean;
  whatsappConnected: boolean;
  shopSlug: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <CreateMemberForm whatsappConnected={whatsappConnected} shopSlug={shopSlug} />
      ) : null}
      <section aria-labelledby="equipe-atual">
        <h2 id="equipe-atual" className="text-lg">
          Quem já está na equipe
        </h2>
        <ul className="mt-3 overflow-hidden rounded-painel border border-rejunte bg-rejunte">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-3 bg-white px-5 py-4 [&:not(:first-child)]:mt-px"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {member.name}{" "}
                    {member.isYou ? (
                      <span className="font-normal text-tinta-suave">(você)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[15px] text-tinta-suave">
                    {member.role === "owner" ? member.login : `Usuário: ${member.login}`}
                    {member.phone ? `, ${formatBrPhone(member.phone)}` : ""}
                  </p>
                </div>
                {canManage && member.role !== "owner" && !member.isYou ? (
                  <RoleSelect member={member} />
                ) : (
                  <Badge tone={member.role === "owner" ? "ok" : "neutral"}>
                    {ROLE_LABELS[member.role]}
                  </Badge>
                )}
              </div>
              {canManage && member.role !== "owner" && !member.isYou ? (
                <MemberActions member={member} whatsappConnected={whatsappConnected} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Mostra o acesso uma única vez, para copiar ou ditar para a pessoa. */
function AccessCard({ access, title }: { access: AccessResult; title: string }) {
  const text = `Endereço: ${access.loginUrl}\nUsuário: ${access.username}\nSenha: ${access.password}`;
  return (
    <Notice tone="success" title={title}>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-tinta">
        <dt className="text-tinta-suave">Endereço</dt>
        <dd className="break-all">{access.loginUrl}</dd>
        <dt className="text-tinta-suave">Usuário</dt>
        <dd className="font-medium">{access.username}</dd>
        <dt className="text-tinta-suave">Senha</dt>
        <dd className="font-medium tabular">{access.password}</dd>
      </dl>
      <p className="mt-2 text-sm">
        {access.sentByWhatsApp
          ? "Também enviamos pelo WhatsApp."
          : "Passe esses dados para a pessoa. A senha não aparece de novo depois que você sair desta tela."}
      </p>
      <div className="mt-3">
        <CopyButton value={text} label="Copiar acesso" size="sm" />
      </div>
    </Notice>
  );
}

function CreateMemberForm({
  whatsappConnected,
  shopSlug,
}: {
  whatsappConnected: boolean;
  shopSlug: string;
}) {
  const [state, action] = useActionState(createMemberAction, null);
  const created = state?.ok ? state.data : undefined;
  return (
    <Panel>
      <PanelSection className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg">Criar acesso para uma pessoa</h2>
          <p className="mt-1 text-[15px] text-tinta-suave">
            Você escolhe o usuário e a senha. A pessoa não precisa de e-mail.
          </p>
        </div>
        <ActionFeedback state={state} />
        {created ? (
          <AccessCard access={created} title={`Acesso de ${created.name} criado.`} />
        ) : null}
      </PanelSection>
      {/* Depois de criar, recria o formulário para limpar os campos. */}
      <CreateMemberFields
        key={created ? created.username : "novo"}
        action={action}
        state={state}
        whatsappConnected={whatsappConnected}
        shopSlug={shopSlug}
      />
    </Panel>
  );
}

function CreateMemberFields({
  action,
  state,
  whatsappConnected,
  shopSlug,
}: {
  action: (formData: FormData) => void;
  state: Parameters<typeof fieldError>[0];
  whatsappConnected: boolean;
  shopSlug: string;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [password, setPassword] = useState(generatePassword);
  const [role, setRole] = useState<Role>("reception");
  const [phone, setPhone] = useState("");
  const shownUsername = usernameEdited ? username : suggestUsername(name, shopSlug);

  return (
    <ActionForm action={action} noValidate>
      <PanelSection className="flex flex-col gap-5 pt-0 sm:pt-0">
        <Field label="Nome" error={fieldError(state, "name")}>
          {(props) => (
            <Input
              {...props}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Usuário para entrar"
            hint="Letras minúsculas, números e ponto."
            error={fieldError(state, "username")}
          >
            {(props) => (
              <Input
                {...props}
                name="username"
                value={shownUsername}
                onChange={(e) => {
                  setUsernameEdited(true);
                  setUsername(e.target.value.toLowerCase());
                }}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                required
              />
            )}
          </Field>
          <Field
            label="Senha"
            hint="Pelo menos 8 caracteres. A pessoa pode trocar depois."
            error={fieldError(state, "password")}
          >
            {(props) => (
              <div className="flex gap-2">
                <Input
                  {...props}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  spellCheck={false}
                  required
                />
                <Button
                  variant="secondary"
                  className="h-12 shrink-0 px-3"
                  onClick={() => setPassword(generatePassword())}
                  aria-label="Gerar outra senha"
                  title="Gerar outra senha"
                >
                  <RefreshCw className="size-4" aria-hidden />
                </Button>
              </div>
            )}
          </Field>
        </div>
        <Field
          label="Celular com WhatsApp"
          optional
          error={fieldError(state, "phone")}
          hint={
            whatsappConnected
              ? "Para mandar o acesso pelo WhatsApp do pet shop."
              : "Conecte o WhatsApp do pet shop para mandar o acesso por lá."
          }
        >
          {(props) => (
            <Input
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="(19) 98765-4321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}
        </Field>
        <ChoiceCards
          name="role"
          legend="O que a pessoa vai fazer"
          columns={3}
          value={role}
          onChange={setRole}
          options={INVITABLE_ROLES.map((value) => ({
            value,
            label: ROLE_LABELS[value],
            description: ROLE_DESCRIPTIONS[value],
          }))}
        />
        {whatsappConnected && phone.trim() ? (
          <Checkbox
            name="sendWhatsApp"
            defaultChecked
            label="Enviar usuário e senha pelo WhatsApp"
          />
        ) : null}
      </PanelSection>
      <PanelSection>
        <SubmitButton size="lg" pendingLabel="Criando acesso…">
          Criar acesso
        </SubmitButton>
      </PanelSection>
    </ActionForm>
  );
}

function RoleSelect({ member }: { member: MemberItem }) {
  const [state, roleAction] = useActionState(updateMemberRoleAction, null);
  return (
    <ActionForm action={roleAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="memberId" value={member.id} />
      <label className="sr-only" htmlFor={`papel-${member.id}`}>
        Papel de {member.name}
      </label>
      <Select
        id={`papel-${member.id}`}
        name="role"
        defaultValue={member.role}
        className="h-10 w-[230px]"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {INVITABLE_ROLES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </Select>
      <ActionFeedback state={state} />
    </ActionForm>
  );
}

function MemberActions({
  member,
  whatsappConnected,
}: {
  member: MemberItem;
  whatsappConnected: boolean;
}) {
  const [state, resetAction] = useActionState(resetMemberPasswordAction, null);
  const [password, setPassword] = useState(generatePassword);
  const reset = state?.ok ? state.data : undefined;
  return (
    <div className="flex flex-col gap-3">
      {reset ? (
        <AccessCard access={reset} title={`Nova senha de ${member.name.split(" ")[0]}.`} />
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-campo py-1 text-sm font-medium text-azulejo [&::-webkit-details-marker]:hidden">
            <KeyRound className="size-4" aria-hidden /> Definir nova senha
          </summary>
          <ActionForm action={resetAction} className="mt-3 flex flex-col gap-3" noValidate>
            <ActionFeedback state={state} />
            <input type="hidden" name="memberId" value={member.id} />
            <Field
              label={`Nova senha para ${member.name.split(" ")[0]}`}
              hint="A pessoa sai de todos os aparelhos e entra de novo com a senha nova."
              error={fieldError(state, "password")}
            >
              {(props) => (
                <div className="flex max-w-md gap-2">
                  <Input
                    {...props}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                  <Button
                    variant="secondary"
                    className="h-12 shrink-0 px-3"
                    onClick={() => setPassword(generatePassword())}
                    aria-label="Gerar outra senha"
                  >
                    <RefreshCw className="size-4" aria-hidden />
                  </Button>
                </div>
              )}
            </Field>
            {whatsappConnected && member.phone ? (
              <Checkbox
                name="sendWhatsApp"
                defaultChecked
                label="Enviar a nova senha pelo WhatsApp"
              />
            ) : null}
            <div>
              <SubmitButton variant="secondary" pendingLabel="Salvando…">
                Salvar nova senha
              </SubmitButton>
            </div>
          </ActionForm>
        </details>
        <details>
          <summary className="cursor-pointer list-none rounded-campo py-1 text-sm text-tinta-suave hover:text-alerta [&::-webkit-details-marker]:hidden">
            Remover da equipe
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[15px] text-tinta-suave">
              A pessoa perde o acesso na hora. O histórico do que ela fez continua guardado.
            </p>
            <ActionButton
              action={removeMemberAction}
              hidden={{ memberId: member.id }}
              variant="danger"
              size="sm"
              pendingLabel="Removendo…"
            >
              Remover {member.name.split(" ")[0]}
            </ActionButton>
          </div>
        </details>
      </div>
    </div>
  );
}
