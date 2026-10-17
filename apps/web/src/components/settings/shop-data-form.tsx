"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState, useRef, useState } from "react";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel, PanelSection } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveShopDataAction } from "@/server/settings-actions";

export interface ShopDataValues {
  name: string;
  legalName: string;
  document: string;
  phone: string;
  email: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
  timezone: string;
}

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Horário de Brasília" },
  { value: "America/Manaus", label: "Amazonas, Rondônia e Roraima (1h a menos)" },
  { value: "America/Cuiaba", label: "Mato Grosso e Mato Grosso do Sul (1h a menos)" },
  { value: "America/Rio_Branco", label: "Acre (2h a menos)" },
  { value: "America/Noronha", label: "Fernando de Noronha (1h a mais)" },
];

function timezoneForState(uf: string): string {
  if (["AM", "RO", "RR"].includes(uf)) return "America/Manaus";
  if (["MT", "MS"].includes(uf)) return "America/Cuiaba";
  if (uf === "AC") return "America/Rio_Branco";
  return "America/Sao_Paulo";
}

function maskZip(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function ShopDataForm({ values, wizard }: { values: ShopDataValues; wizard: boolean }) {
  const [state, action] = useActionState(saveShopDataAction, null);
  const [address, setAddress] = useState({
    zip: maskZip(values.addressZip),
    street: values.addressStreet,
    district: values.addressDistrict,
    city: values.addressCity,
    state: values.addressState,
    timezone: values.timezone,
  });
  const [lookup, setLookup] = useState<"idle" | "loading" | "not-found">("idle");
  const numberRef = useRef<HTMLInputElement>(null);

  async function findZip(zip: string) {
    const digits = zip.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLookup("loading");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        setLookup("not-found");
        return;
      }
      setAddress((current) => ({
        ...current,
        street: data.logradouro || current.street,
        district: data.bairro || current.district,
        city: data.localidade || current.city,
        state: data.uf || current.state,
        timezone: data.uf ? timezoneForState(data.uf) : current.timezone,
      }));
      setLookup("idle");
      numberRef.current?.focus();
    } catch {
      setLookup("idle");
    }
  }

  return (
    <ActionForm action={action} noValidate>
      {wizard ? <input type="hidden" name="wizard" value="1" /> : null}
      <Panel>
        <PanelSection className="flex flex-col gap-5">
          <ActionFeedback state={state} />
          <h2 className="text-lg">Pet shop</h2>
          <Field label="Nome do pet shop" error={fieldError(state, "name")} hint="Aparece para os clientes nas mensagens e no portal.">
            {(props) => <Input {...props} name="name" defaultValue={values.name} required />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="WhatsApp ou telefone de contato" error={fieldError(state, "phone")}>
              {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" defaultValue={values.phone} placeholder="(19) 98765-4321" required />}
            </Field>
            <Field label="E-mail de contato" optional error={fieldError(state, "email")}>
              {(props) => <Input {...props} name="email" type="email" defaultValue={values.email} />}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="CNPJ ou CPF" optional error={fieldError(state, "document")} hint="Aparece nos recibos.">
              {(props) => <Input {...props} name="document" defaultValue={values.document} inputMode="text" />}
            </Field>
            <Field label="Razão social" optional error={fieldError(state, "legalName")}>
              {(props) => <Input {...props} name="legalName" defaultValue={values.legalName} />}
            </Field>
          </div>
        </PanelSection>
        <PanelSection className="flex flex-col gap-5">
          <h2 className="text-lg">Endereço</h2>
          <Field
            label="CEP"
            optional
            hint={
              lookup === "loading" ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Buscando endereço…
                </span>
              ) : lookup === "not-found" ? (
                "Não encontramos este CEP. Preencha o endereço abaixo."
              ) : (
                "Digite o CEP e o resto se preenche sozinho."
              )
            }
            error={fieldError(state, "addressZip")}
          >
            {(props) => (
              <Input
                {...props}
                name="addressZip"
                inputMode="numeric"
                autoComplete="postal-code"
                value={address.zip}
                onChange={(event) => {
                  const zip = maskZip(event.target.value);
                  setAddress((current) => ({ ...current, zip }));
                  if (zip.replace(/\D/g, "").length === 8) void findZip(zip);
                }}
                className="max-w-[180px]"
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Rua" optional error={fieldError(state, "addressStreet")}>
              {(props) => (
                <Input {...props} name="addressStreet" value={address.street} onChange={(e) => setAddress((c) => ({ ...c, street: e.target.value }))} autoComplete="address-line1" />
              )}
            </Field>
            <Field label="Número" optional error={fieldError(state, "addressNumber")}>
              {(props) => <Input {...props} ref={numberRef} name="addressNumber" defaultValue={values.addressNumber} />}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Complemento" optional>
              {(props) => <Input {...props} name="addressComplement" defaultValue={values.addressComplement} />}
            </Field>
            <Field label="Bairro" optional>
              {(props) => (
                <Input {...props} name="addressDistrict" value={address.district} onChange={(e) => setAddress((c) => ({ ...c, district: e.target.value }))} />
              )}
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Cidade" error={fieldError(state, "addressCity")}>
              {(props) => (
                <Input {...props} name="addressCity" value={address.city} onChange={(e) => setAddress((c) => ({ ...c, city: e.target.value }))} autoComplete="address-level2" required />
              )}
            </Field>
            <Field label="Estado" error={fieldError(state, "addressState")}>
              {(props) => (
                <Select
                  {...props}
                  name="addressState"
                  value={address.state}
                  onChange={(e) => setAddress((c) => ({ ...c, state: e.target.value, timezone: timezoneForState(e.target.value) }))}
                  required
                >
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label="Fuso horário" hint="Usado na agenda e no horário das mensagens.">
            {(props) => (
              <Select {...props} name="timezone" value={address.timezone} onChange={(e) => setAddress((c) => ({ ...c, timezone: e.target.value }))}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </PanelSection>
        <PanelSection>
          <SubmitButton size="lg" pendingLabel="Salvando…">
            {wizard ? "Salvar e continuar" : "Salvar dados"}
          </SubmitButton>
        </PanelSection>
      </Panel>
    </ActionForm>
  );
}
