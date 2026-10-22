"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState, useState } from "react";
import { PIX_KEY_TYPE_LABELS, type PixKeyType } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { savePixAction } from "@/server/settings-actions";

const PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "financeiro@seupetshop.com.br",
  phone: "(19) 98765-4321",
  random: "123e4567-e89b-12d3-a456-426614174000",
};

export interface PixValues {
  keyType: PixKeyType;
  key: string;
  merchantName: string;
  merchantCity: string;
}

export function PixForm({ values, canEdit }: { values: PixValues; canEdit: boolean }) {
  const [state, action] = useActionState(savePixAction, null);
  const [keyType, setKeyType] = useState<PixKeyType>(values.keyType);
  const [name, setName] = useState(values.merchantName);
  const [city, setCity] = useState(values.merchantCity);

  return (
    <ActionForm action={action} noValidate>
      <Panel>
        <PanelSection className="flex flex-col gap-5">
          <ActionFeedback state={state} />
          <ChoiceCards
            name="keyType"
            legend="Tipo da chave"
            columns={5}
            value={keyType}
            onChange={setKeyType}
            options={(Object.keys(PIX_KEY_TYPE_LABELS) as PixKeyType[]).map((value) => ({
              value,
              label: PIX_KEY_TYPE_LABELS[value],
            }))}
          />
          <Field
            label="Chave PIX"
            error={fieldError(state, "key")}
            hint="Copie do app do banco para não errar."
          >
            {(props) => (
              <Input
                {...props}
                key={keyType}
                name="key"
                defaultValue={keyType === values.keyType ? values.key : ""}
                placeholder={PLACEHOLDERS[keyType]}
                inputMode={
                  keyType === "cpf" || keyType === "cnpj"
                    ? "text"
                    : keyType === "phone"
                      ? "tel"
                      : keyType === "email"
                        ? "email"
                        : "text"
                }
                autoComplete="off"
                disabled={!canEdit}
              />
            )}
          </Field>
        </PanelSection>
        <PanelSection className="flex flex-col gap-5">
          <p className="text-[15px] text-tinta-suave">
            Quem paga vê o nome e a cidade abaixo no app do banco, antes de confirmar. Sem acentos,
            como pede o padrão do PIX.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Nome do recebedor"
              error={fieldError(state, "merchantName")}
              hint={`${name.length}/25 caracteres`}
            >
              {(props) => (
                <Input
                  {...props}
                  name="merchantName"
                  value={name}
                  maxLength={25}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                />
              )}
            </Field>
            <Field
              label="Cidade"
              error={fieldError(state, "merchantCity")}
              hint={`${city.length}/15 caracteres`}
            >
              {(props) => (
                <Input
                  {...props}
                  name="merchantCity"
                  value={city}
                  maxLength={15}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!canEdit}
                />
              )}
            </Field>
          </div>
        </PanelSection>
        {canEdit ? (
          <PanelSection>
            <SubmitButton size="lg" pendingLabel="Salvando…">
              Salvar chave PIX
            </SubmitButton>
          </PanelSection>
        ) : null}
      </Panel>
    </ActionForm>
  );
}
