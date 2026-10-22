"use client";

import { ActionForm } from "@/components/ui/action-form";

import { useActionState, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, X } from "lucide-react";
import {
  centsToInput,
  describeSizeRange,
  formatBRL,
  formatDuration,
  parseBRL,
  SIZE_LABELS,
  SIZES,
  type Size,
  type SizeRanges,
} from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/choice";
import { Field, Input, Select, Textarea, inputClasses } from "@/components/ui/field";
import { Panel, PanelSection } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import type { SuggestedService } from "@/lib/suggested-services";
import {
  addSuggestedServicesAction,
  archiveServiceAction,
  saveServiceAction,
  saveSizeRangesAction,
} from "@/server/settings-actions";

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isAddon: boolean;
  showInPortal: boolean;
  prices: { size: Size; priceCents: number; durationMinutes: number }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  banho: "Banho",
  tosa: "Tosa",
  estetica: "Estética",
  saude: "Saúde",
  outros: "Outros",
};

const DURATIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15);

function range(values: number[], format: (value: number) => string) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? format(min) : `${format(min)} a ${format(max)}`;
}

export function ServicesManager({
  services,
  suggested,
  sizeRanges,
  canEdit,
}: {
  services: ServiceItem[];
  suggested: SuggestedService[];
  sizeRanges: SizeRanges;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ServiceItem | "new" | null>(null);
  const main = services.filter((s) => !s.isAddon);
  const addons = services.filter((s) => s.isAddon);

  return (
    <div className="flex flex-col gap-6">
      {services.length === 0 && canEdit ? (
        <SuggestedPicker suggested={suggested} onCreateBlank={() => setEditing("new")} />
      ) : null}

      {services.length > 0 ? (
        <>
          <ServiceList title="Serviços" items={main} onEdit={canEdit ? setEditing : undefined} />
          {addons.length > 0 ? (
            <ServiceList
              title="Adicionais"
              description="Podem ser incluídos junto com um serviço, no agendamento ou durante o atendimento."
              items={addons}
              onEdit={canEdit ? setEditing : undefined}
            />
          ) : null}
          {canEdit ? (
            <div>
              <Button variant="secondary" onClick={() => setEditing("new")}>
                <Plus className="size-4" aria-hidden /> Novo serviço
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <SizeRangesForm ranges={sizeRanges} canEdit={canEdit} />

      {editing !== null ? (
        <ServiceEditor
          key={editing === "new" ? "novo" : editing.id}
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          sizeRanges={sizeRanges}
        />
      ) : null}
    </div>
  );
}

function ServiceList({
  title,
  description,
  items,
  onEdit,
}: {
  title: string;
  description?: string;
  items: ServiceItem[];
  onEdit?: (service: ServiceItem) => void;
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="mt-1 text-[15px] text-tinta-suave">{description}</p> : null}
      <ul className="mt-3 overflow-hidden rounded-painel border border-rejunte bg-rejunte">
        {items.map((service) => (
          <li
            key={service.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white px-5 py-4 [&:not(:first-child)]:mt-px"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {service.name}
                {!service.showInPortal ? <Badge>Fora do portal</Badge> : null}
              </p>
              <p className="text-[15px] text-tinta-suave tabular">
                {range(
                  service.prices.map((p) => p.priceCents),
                  formatBRL,
                )}
                {service.prices.length ? ", " : ""}
                {range(
                  service.prices.map((p) => p.durationMinutes),
                  formatDuration,
                )}
              </p>
            </div>
            {onEdit ? (
              <Button
                variant="ghost"
                onClick={() => onEdit(service)}
                aria-label={`Editar ${service.name}`}
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuggestedPicker({
  suggested,
  onCreateBlank,
}: {
  suggested: SuggestedService[];
  onCreateBlank: () => void;
}) {
  const [state, action] = useActionState(addSuggestedServicesAction, null);
  return (
    <Panel>
      <ActionForm action={action}>
        <PanelSection>
          <h2 className="text-lg">Comece pela lista sugerida</h2>
          <p className="mt-1 text-[15px] text-tinta-suave">
            Marque o que vocês fazem. Os preços e tempos são sugestões: dá para ajustar cada um
            depois.
          </p>
        </PanelSection>
        <PanelSection className="flex flex-col gap-3">
          <ActionFeedback state={state} />
          {suggested.map((service) => (
            <Checkbox
              key={service.key}
              name="suggested"
              value={service.key}
              defaultChecked
              label={
                <span>
                  <span className="font-medium">{service.name}</span>
                  {service.isAddon ? <span className="text-tinta-suave"> (adicional)</span> : null}
                  <span className="block text-sm text-tinta-suave tabular">
                    {range(
                      service.prices.map((p) => p.priceCents),
                      formatBRL,
                    )}
                    ,{" "}
                    {range(
                      service.prices.map((p) => p.durationMinutes),
                      formatDuration,
                    )}
                  </span>
                </span>
              }
            />
          ))}
          <input type="hidden" name="_" value="" />
        </PanelSection>
        <PanelSection className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton size="lg" pendingLabel="Adicionando…">
            Adicionar serviços marcados
          </SubmitButton>
          <Button variant="ghost" onClick={onCreateBlank}>
            Criar um serviço do zero
          </Button>
        </PanelSection>
      </ActionForm>
    </Panel>
  );
}

type PriceRow = { size: Size; price: string; durationMinutes: number };

function initialRows(service: ServiceItem | null): PriceRow[] {
  return SIZES.map((size) => {
    const existing = service?.prices.find((p) => p.size === size);
    return {
      size,
      price: existing ? centsToInput(existing.priceCents) : "",
      durationMinutes: existing?.durationMinutes ?? 60,
    };
  });
}

function ServiceEditor({
  service,
  onClose,
  sizeRanges,
}: {
  service: ServiceItem | null;
  onClose: () => void;
  sizeRanges: SizeRanges;
}) {
  const [state, action] = useActionState(saveServiceAction, null);
  const [rows, setRows] = useState<PriceRow[]>(() => initialRows(service));
  const [isAddon, setIsAddon] = useState(service?.isAddon ?? false);
  const [showInPortal, setShowInPortal] = useState(service?.showInPortal ?? true);

  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const parsed = rows.map((row) => ({
    size: row.size,
    priceCents: parseBRL(row.price),
    durationMinutes: row.durationMinutes,
  }));
  const complete = parsed.every((p) => p.priceCents !== null);

  const copyFirst = () =>
    setRows((current) =>
      current.map((row) => ({
        ...row,
        price: current[0]!.price,
        durationMinutes: current[0]!.durationMinutes,
      })),
    );

  return (
    <Dialog.Root open onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-tinta/30" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-painel bg-white sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(640px,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-painel">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rejunte bg-white px-5 py-4 sm:px-6">
            <Dialog.Title className="text-xl font-[650]">
              {service ? `Editar ${service.name}` : "Novo serviço"}
            </Dialog.Title>
            <Dialog.Close
              className="inline-flex size-11 items-center justify-center rounded-campo hover:bg-espuma"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Nome, tipo, preços e tempos por porte
          </Dialog.Description>
          <ActionForm action={action} className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            <ActionFeedback state={state} />
            {service ? <input type="hidden" name="id" value={service.id} /> : null}
            <input
              type="hidden"
              name="prices"
              value={JSON.stringify(parsed.map((p) => ({ ...p, priceCents: p.priceCents ?? -1 })))}
            />
            {isAddon ? <input type="hidden" name="isAddon" value="on" /> : null}
            {showInPortal ? <input type="hidden" name="showInPortal" value="on" /> : null}
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Nome" error={fieldError(state, "name")}>
                {(props) => <Input {...props} name="name" defaultValue={service?.name} required />}
              </Field>
              <Field label="Tipo">
                {(props) => (
                  <Select {...props} name="category" defaultValue={service?.category ?? "banho"}>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field
              label="Descrição"
              optional
              hint="O que está incluído. Aparece para o tutor no portal."
            >
              {(props) => (
                <Textarea
                  {...props}
                  name="description"
                  defaultValue={service?.description ?? ""}
                  rows={2}
                />
              )}
            </Field>
            <div className="flex flex-col gap-3">
              <Switch
                checked={isAddon}
                onChange={setIsAddon}
                label="É um adicional (feito junto com outro serviço)"
              />
              <Switch
                checked={showInPortal}
                onChange={setShowInPortal}
                label="Tutor pode escolher no agendamento online"
              />
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 font-medium">
                Preço e tempo por porte
                <Button variant="ghost" size="sm" onClick={copyFirst}>
                  Usar os valores do pequeno em todos
                </Button>
              </legend>
              {rows.map((row, index) => (
                <div
                  key={row.size}
                  className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-end gap-3"
                >
                  <div className="pb-3">
                    <p className="font-medium">{SIZE_LABELS[row.size]}</p>
                    <p className="text-sm text-tinta-suave">
                      {describeSizeRange(row.size, sizeRanges)}
                    </p>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-tinta-suave">Preço (R$)</span>
                    <input
                      inputMode="decimal"
                      value={row.price}
                      placeholder="0,00"
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((r, i) =>
                            i === index ? { ...r, price: e.target.value } : r,
                          ),
                        )
                      }
                      className={cn(inputClasses, "tabular")}
                      aria-invalid={
                        row.price !== "" && parseBRL(row.price) === null ? true : undefined
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-tinta-suave">Tempo</span>
                    <select
                      value={row.durationMinutes}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((r, i) =>
                            i === index ? { ...r, durationMinutes: Number(e.target.value) } : r,
                          ),
                        )
                      }
                      className={cn(inputClasses, "tabular")}
                    >
                      {DURATIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {formatDuration(minutes)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              {fieldError(state, "prices") ? (
                <p className="text-sm font-medium text-alerta">{fieldError(state, "prices")}</p>
              ) : null}
            </fieldset>
            <div className="border-t border-rejunte pt-5">
              <SubmitButton size="lg" pendingLabel="Salvando…" disabled={!complete}>
                {service ? "Salvar serviço" : "Criar serviço"}
              </SubmitButton>
            </div>
          </ActionForm>
          {service ? (
            <div className="border-t border-rejunte px-5 py-4 sm:px-6">
              <RemoveService id={service.id} onDone={onClose} />
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RemoveService({ id, onDone }: { id: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(archiveServiceAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)} className="text-alerta">
        Remover serviço
      </Button>
    );
  }
  return (
    <ActionForm action={action} className="flex flex-col gap-3">
      <ActionFeedback state={state} />
      <p className="text-[15px]">
        O serviço sai da lista e do agendamento online. O histórico de atendimentos continua
        guardado.
      </p>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="danger" pendingLabel="Removendo…">
          Confirmar remoção
        </SubmitButton>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Manter serviço
        </Button>
      </div>
    </ActionForm>
  );
}

function SizeRangesForm({ ranges, canEdit }: { ranges: SizeRanges; canEdit: boolean }) {
  const [state, action] = useActionState(saveSizeRangesAction, null);
  return (
    <details className="rounded-painel border border-rejunte bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
        Faixas de peso de cada porte
        <span className="block text-sm font-normal text-tinta-suave">
          Pequeno até {ranges.P} kg, médio até {ranges.M} kg, grande até {ranges.G} kg, gigante
          acima disso.
        </span>
      </summary>
      <ActionForm action={action} className="flex flex-col gap-4 border-t border-rejunte px-5 py-4">
        <ActionFeedback state={state} />
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {(["P", "M", "G"] as const).map((size) => (
            <Field key={size} label={`${SIZE_LABELS[size]} até (kg)`}>
              {(props) => (
                <Input
                  {...props}
                  name={size}
                  inputMode="decimal"
                  defaultValue={String(ranges[size])}
                  disabled={!canEdit}
                />
              )}
            </Field>
          ))}
        </div>
        <p className="text-sm text-tinta-suave">
          O porte do pet é sugerido pelo peso e pode ser ajustado na ficha dele.
        </p>
        {canEdit ? (
          <div>
            <SubmitButton variant="secondary" pendingLabel="Salvando…">
              Salvar faixas
            </SubmitButton>
          </div>
        ) : null}
      </ActionForm>
    </details>
  );
}
