"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Search, X } from "lucide-react";
import {
  formatBRL,
  formatBrPhone,
  formatDuration,
  formatLocalDate,
  formatTime,
  type Size,
  type SizeRanges,
} from "@petshop/core";
import { ActionFeedback } from "@/components/action-feedback";
import { PetDialog } from "@/components/customers/pet-dialog";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelSection } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AvailableTimes, BookableService } from "@/lib/agenda";
import { cn } from "@/lib/cn";
import { capitalize } from "@/lib/format";
import type { CustomerListItem } from "@/lib/customers";
import { createAppointmentAction } from "@/server/agenda-actions";
import { QuickCustomer } from "./quick-customer";

async function fetchCustomers(params: string): Promise<CustomerListItem[]> {
  const response = await fetch(`/api/agenda/clientes?${params}`);
  if (!response.ok) return [];
  return ((await response.json()) as { customers: CustomerListItem[] }).customers;
}

export function BookingWizard({
  services,
  sizeRanges,
  initialCustomer,
  initialDate,
  initialStart,
  today,
  canOverbook,
  canManageCustomers,
  showPrices,
}: {
  services: BookableService[];
  sizeRanges: SizeRanges;
  initialCustomer: CustomerListItem | null;
  initialDate: string;
  initialStart: number | null;
  today: string;
  canOverbook: boolean;
  canManageCustomers: boolean;
  showPrices: boolean;
}) {
  const [state, action] = useActionState(createAppointmentAction, null);
  const [customer, setCustomer] = useState<CustomerListItem | null>(initialCustomer);
  /** Serviços escolhidos por pet (só pets marcados aparecem aqui). */
  const [selection, setSelection] = useState<Record<string, string[]>>(() =>
    initialCustomer?.pets.length === 1 ? { [initialCustomer.pets[0]!.id]: [] } : {},
  );
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState<number | null>(initialStart);
  const [overbook, setOverbook] = useState(false);

  const chosenPets = (customer?.pets ?? []).filter((pet) => pet.id in selection);
  const lines = chosenPets.map((pet) => {
    const chosen = (selection[pet.id] ?? [])
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is BookableService => Boolean(s?.prices[pet.size as Size]));
    const duration = chosen.reduce(
      (sum, s) => sum + s.prices[pet.size as Size]!.durationMinutes,
      0,
    );
    const price = chosen.reduce((sum, s) => sum + s.prices[pet.size as Size]!.priceCents, 0);
    return { pet, services: chosen, duration, price };
  });
  const ready = lines.length > 0 && lines.every((l) => l.services.length > 0);
  const durations = ready ? lines.map((l) => l.duration) : [];
  const timesKey = ready && date ? `${date}|${durations.join(",")}` : null;

  const [times, setTimes] = useState<{ key: string; data: AvailableTimes | null } | null>(null);
  useEffect(() => {
    if (!timesKey) return;
    const [day, list] = timesKey.split("|");
    let active = true;
    fetch(`/api/agenda/horarios?data=${day}&duracoes=${list}`)
      .then((r) => (r.ok ? (r.json() as Promise<AvailableTimes>) : null))
      .catch(() => null)
      .then((data) => {
        if (active) setTimes({ key: timesKey, data });
      });
    return () => {
      active = false;
    };
  }, [timesKey]);
  const loadingTimes = timesKey !== null && times?.key !== timesKey;
  const available = !loadingTimes && times?.data ? times.data : null;
  const options = available ? (overbook ? available.all : available.starts) : [];
  const chosenStart = start !== null && options.includes(start) ? start : null;
  const totalPrice = lines.reduce((sum, l) => sum + l.price, 0);
  const longest = Math.max(0, ...durations);

  const refreshCustomer = async (id: string, selectPetId?: string) => {
    const [fresh] = await fetchCustomers(`id=${id}`);
    if (!fresh) return;
    setCustomer(fresh);
    if (selectPetId)
      setSelection((current) => ({ ...current, [selectPetId]: current[selectPetId] ?? [] }));
  };

  const togglePet = (petId: string) =>
    setSelection((current) => {
      const next = { ...current };
      if (petId in next) delete next[petId];
      else next[petId] = [];
      return next;
    });

  const toggleService = (petId: string, serviceId: string) =>
    setSelection((current) => {
      const list = current[petId] ?? [];
      return {
        ...current,
        [petId]: list.includes(serviceId)
          ? list.filter((id) => id !== serviceId)
          : [...list, serviceId],
      };
    });

  return (
    <ActionForm action={action} className="flex flex-col gap-5" noValidate>
      <ActionFeedback state={state} />
      <input type="hidden" name="customerId" value={customer?.id ?? ""} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start" value={chosenStart ?? ""} />
      <input type="hidden" name="overbook" value={overbook ? "on" : ""} />
      <input
        type="hidden"
        name="pets"
        value={JSON.stringify(
          lines.map((l) => ({ petId: l.pet.id, serviceIds: l.services.map((s) => s.id) })),
        )}
      />

      <Step number={1} title="Cliente" done={Boolean(customer)}>
        {customer ? (
          <div className="flex items-center justify-between gap-3 rounded-campo border border-rejunte bg-espuma px-4 py-3">
            <div>
              <p className="font-medium">{customer.name}</p>
              <p className="text-[15px] text-tinta-suave tabular">
                {formatBrPhone(customer.phone)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomer(null);
                setSelection({});
              }}
            >
              <X className="size-4" aria-hidden /> Trocar
            </Button>
          </div>
        ) : (
          <CustomerSearch
            sizeRanges={sizeRanges}
            canCreate={canManageCustomers}
            onSelect={(found) => {
              setCustomer(found);
              setSelection(found.pets.length === 1 ? { [found.pets[0]!.id]: [] } : {});
            }}
            onCreated={(saved) => void refreshCustomer(saved.id, saved.petId ?? undefined)}
          />
        )}
      </Step>

      {customer ? (
        <Step number={2} title="Pets e serviços" done={ready}>
          {customer.pets.length === 0 ? (
            <p className="text-tinta-suave">Este cliente ainda não tem pet cadastrado.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {customer.pets.map((pet) => {
                const checked = pet.id in selection;
                const size = pet.size as Size;
                return (
                  <li
                    key={pet.id}
                    className={cn(
                      "rounded-campo border bg-white transition-colors",
                      checked ? "border-azulejo ring-1 ring-azulejo" : "border-rejunte-forte",
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePet(pet.id)}
                        className="size-5 shrink-0 accent-azulejo"
                      />
                      <span className="font-medium">{pet.name}</span>
                      <span className="text-sm text-tinta-suave">porte {pet.size}</span>
                    </label>
                    {checked ? (
                      <fieldset className="border-t border-rejunte px-4 py-3">
                        <legend className="sr-only">Serviços para {pet.name}</legend>
                        <div className="flex flex-wrap gap-2">
                          {services.map((service) => {
                            const price = service.prices[size];
                            const on = (selection[pet.id] ?? []).includes(service.id);
                            return (
                              <button
                                key={service.id}
                                type="button"
                                aria-pressed={on}
                                disabled={!price}
                                onClick={() => toggleService(pet.id, service.id)}
                                className={cn(
                                  "inline-flex min-h-11 items-center gap-2 rounded-campo border px-3 py-1.5 text-left text-[15px] transition-colors",
                                  on
                                    ? "border-azulejo bg-azulejo text-white"
                                    : "border-rejunte-forte bg-white hover:border-tinta-suave",
                                  !price && "cursor-not-allowed opacity-50",
                                )}
                              >
                                {on ? <Check className="size-4" aria-hidden /> : null}
                                <span>
                                  {service.isAddon ? "+ " : ""}
                                  {service.name}{" "}
                                  <span
                                    className={cn(
                                      "ml-1.5 text-sm",
                                      on ? "text-white/80" : "text-tinta-suave",
                                    )}
                                  >
                                    {price
                                      ? [
                                          showPrices ? formatBRL(price.priceCents) : null,
                                          formatDuration(price.durationMinutes),
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")
                                      : `sem preço para ${pet.size}`}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {services.length === 0 ? (
                          <p className="text-[15px] text-tinta-suave">
                            Nenhum serviço cadastrado ainda.
                          </p>
                        ) : null}
                      </fieldset>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {canManageCustomers ? (
            <div>
              <PetDialog
                customerId={customer.id}
                sizeRanges={sizeRanges}
                label="Adicionar outro pet"
                variant="ghost"
                onSaved={(petId) => void refreshCustomer(customer.id, petId)}
              />
            </div>
          ) : null}
        </Step>
      ) : null}

      {ready ? (
        <Step number={3} title="Dia e horário" done={chosenStart !== null}>
          <Field label="Dia" className="max-w-xs">
            {(props) => (
              <Input
                {...props}
                type="date"
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="tabular"
              />
            )}
          </Field>
          {loadingTimes ? (
            <p className="flex items-center gap-2 text-tinta-suave">
              <Spinner /> Procurando vagas…
            </p>
          ) : available === null ? (
            <Notice tone="error">Não foi possível carregar os horários. Tente de novo.</Notice>
          ) : !available.open ? (
            <Notice tone="warning">O pet shop não atende neste dia. Escolha outra data.</Notice>
          ) : (
            <>
              {available.starts.length === 0 && !overbook ? (
                <Notice tone="warning">
                  Não há vaga para {lines.length > 1 ? "todos os pets juntos" : "este atendimento"}{" "}
                  neste dia.{" "}
                  {longest > 60
                    ? `Lembre que o atendimento ocupa ${formatDuration(longest)} seguidas. `
                    : ""}
                  Tente outro dia.
                </Notice>
              ) : (
                <fieldset>
                  <legend className="mb-2 text-[15px] font-medium">
                    {overbook ? "Todos os horários (encaixe)" : "Horários com vaga"}
                  </legend>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {options.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        aria-pressed={chosenStart === minutes}
                        onClick={() => setStart(minutes)}
                        className={cn(
                          "h-11 rounded-campo border text-[15px] font-medium tabular transition-colors",
                          chosenStart === minutes
                            ? "border-azulejo bg-azulejo text-white"
                            : "border-rejunte-forte bg-white hover:border-tinta-suave",
                          overbook &&
                            !available.starts.includes(minutes) &&
                            chosenStart !== minutes &&
                            "border-dashed",
                        )}
                      >
                        {formatTime(minutes)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {canOverbook ? (
                <div className="flex flex-col gap-1">
                  <Switch
                    checked={overbook}
                    onChange={setOverbook}
                    label="Encaixe acima das vagas"
                  />
                  {overbook ? (
                    <p className="text-sm text-tinta-suave">
                      Mostra todos os horários. Os de borda tracejada já estão cheios e o pet entra
                      como encaixe.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </Step>
      ) : null}

      {ready && chosenStart !== null ? (
        <Panel>
          <PanelSection className="flex flex-col gap-5">
            <Field label="Observações" optional>
              {(props) => (
                <Textarea
                  {...props}
                  name="notes"
                  rows={2}
                  placeholder="Ex.: tutor vai buscar depois das 17h"
                  className="min-h-0"
                />
              )}
            </Field>
            <div className="rounded-campo bg-espuma p-4">
              <p className="font-medium">
                {capitalize(formatLocalDate(date))}, às {formatTime(chosenStart)}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-[15px]">
                {lines.map((line) => (
                  <li key={line.pet.id} className="flex flex-wrap justify-between gap-x-4">
                    <span>
                      <span className="font-medium">{line.pet.name}</span>:{" "}
                      {line.services.map((s) => s.name).join(", ")}
                    </span>
                    <span className="text-tinta-suave tabular">
                      até {formatTime(chosenStart + line.duration)}
                      {showPrices ? ` · ${formatBRL(line.price)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {showPrices ? (
                <p className="mt-3 flex justify-between border-t border-rejunte pt-3 font-medium">
                  <span>Total</span>
                  <span className="tabular">{formatBRL(totalPrice)}</span>
                </p>
              ) : null}
            </div>
            <SubmitButton size="lg" pendingLabel="Agendando…">
              Confirmar agendamento
            </SubmitButton>
          </PanelSection>
        </Panel>
      ) : null}
    </ActionForm>
  );
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelSection className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-lg">
          <span
            aria-hidden
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-azulejo text-[15px] tabular",
              done ? "bg-azulejo text-white" : "bg-azulejo-claro text-azulejo-escuro",
            )}
          >
            {done ? <Check className="size-4" /> : number}
          </span>
          {title}
        </h2>
        {children}
      </PanelSection>
    </Panel>
  );
}

function CustomerSearch({
  sizeRanges,
  canCreate,
  onSelect,
  onCreated,
}: {
  sizeRanges: SizeRanges;
  canCreate: boolean;
  onSelect: (customer: CustomerListItem) => void;
  onCreated: (customer: { id: string; petId: string | null }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; customers: CustomerListItem[] } | null>(
    null,
  );
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      void fetchCustomers(`q=${encodeURIComponent(term)}`).then((customers) => {
        if (active) setResults({ query: term, customers });
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);
  const current = useMemo(
    () => (results?.query === term ? results.customers : null),
    [results, term],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-tinta-suave"
          aria-hidden
        />
        <label htmlFor="busca-cliente" className="sr-only">
          Buscar cliente por nome, celular ou pet
        </label>
        <Input
          id="busca-cliente"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome do tutor, celular ou nome do pet"
          autoComplete="off"
          autoFocus
          className="pl-11"
        />
      </div>
      {term.length >= 2 ? (
        current === null ? (
          <p className="flex items-center gap-2 text-tinta-suave">
            <Spinner /> Buscando…
          </p>
        ) : current.length === 0 ? (
          <p className="text-tinta-suave">Nenhum cliente encontrado.</p>
        ) : (
          <ul className="overflow-hidden rounded-campo border border-rejunte">
            {current.map((customer) => (
              <li
                key={customer.id}
                className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-rejunte"
              >
                <button
                  type="button"
                  onClick={() => onSelect(customer)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-espuma"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{customer.name}</span>
                    <span className="block text-sm text-tinta-suave tabular">
                      {formatBrPhone(customer.phone)}
                    </span>
                  </span>
                  <span className="text-right text-sm text-tinta-suave">
                    {customer.pets.map((p) => p.name).join(", ") || (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="size-3.5" aria-hidden /> sem pet
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {canCreate ? (
        <div>
          <QuickCustomer sizeRanges={sizeRanges} initialName={term} onCreated={onCreated} />
        </div>
      ) : null}
    </div>
  );
}
