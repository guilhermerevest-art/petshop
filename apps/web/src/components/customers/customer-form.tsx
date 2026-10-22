"use client";

import { useActionState } from "react";
import type { SizeRanges } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Checkbox } from "@/components/ui/choice";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveCustomerAction } from "@/server/customer-actions";
import { EMPTY_PET, PetFields } from "./pet-fields";

export interface CustomerValues {
  id?: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  origin: string;
  notes: string;
  marketingOptIn: boolean;
}

export const EMPTY_CUSTOMER: CustomerValues = {
  name: "",
  phone: "",
  email: "",
  document: "",
  origin: "",
  notes: "",
  marketingOptIn: false,
};

export function CustomerForm({
  values,
  sizeRanges,
}: {
  values: CustomerValues;
  sizeRanges: SizeRanges;
}) {
  const [state, action] = useActionState(saveCustomerAction, null);
  const creating = !values.id;
  return (
    <ActionForm action={action} noValidate>
      <input type="hidden" name="redirectTo" value="ficha" />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Panel>
        <PanelSection className="flex flex-col gap-5">
          <ActionFeedback state={state} />
          <h2 className="text-lg">Tutor</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome" error={fieldError(state, "name")}>
              {(props) => (
                <Input {...props} name="name" defaultValue={values.name} autoComplete="off" />
              )}
            </Field>
            <Field
              label="Celular com WhatsApp"
              error={fieldError(state, "phone")}
              hint="Para confirmações, lembretes e recibos."
            >
              {(props) => (
                <Input
                  {...props}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="(19) 98765-4321"
                  defaultValue={values.phone}
                  autoComplete="off"
                />
              )}
            </Field>
          </div>
          <details className="rounded-campo border border-rejunte" open={!creating}>
            <summary className="cursor-pointer px-4 py-3 text-[15px] font-medium">
              E-mail, CPF e observações (opcional)
            </summary>
            <div className="flex flex-col gap-5 border-t border-rejunte p-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="E-mail" optional error={fieldError(state, "email")}>
                  {(props) => (
                    <Input {...props} name="email" type="email" defaultValue={values.email} />
                  )}
                </Field>
                <Field
                  label="CPF"
                  optional
                  error={fieldError(state, "document")}
                  hint="Aparece no recibo."
                >
                  {(props) => <Input {...props} name="document" defaultValue={values.document} />}
                </Field>
              </div>
              <Field label="Como conheceu o pet shop" optional>
                {(props) => (
                  <Input
                    {...props}
                    name="origin"
                    placeholder="Ex.: Instagram, indicação, passou na frente"
                    defaultValue={values.origin}
                  />
                )}
              </Field>
              <Field label="Observações" optional>
                {(props) => (
                  <Textarea {...props} name="notes" rows={2} defaultValue={values.notes} />
                )}
              </Field>
            </div>
          </details>
          <Checkbox
            name="marketingOptIn"
            defaultChecked={values.marketingOptIn}
            label="O tutor aceita receber novidades e promoções pelo WhatsApp"
          />
        </PanelSection>
        {creating ? (
          <PanelSection className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg">Primeiro pet</h2>
              <p className="mt-1 text-[15px] text-tinta-suave">
                Opcional: deixe o nome em branco para cadastrar depois.
              </p>
            </div>
            <PetFields values={EMPTY_PET} sizeRanges={sizeRanges} state={state} compact />
          </PanelSection>
        ) : null}
        <PanelSection>
          <SubmitButton size="lg" pendingLabel="Salvando…">
            {creating ? "Cadastrar cliente" : "Salvar cliente"}
          </SubmitButton>
        </PanelSection>
      </Panel>
    </ActionForm>
  );
}
