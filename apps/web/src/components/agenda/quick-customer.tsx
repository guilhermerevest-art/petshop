"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import type { SizeRanges } from "@petshop/core";
import { ActionFeedback, fieldError } from "@/components/action-feedback";
import { EMPTY_PET, PetFields } from "@/components/customers/pet-fields";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveCustomerAction, type SavedCustomer } from "@/server/customer-actions";

/** Cadastro rápido de tutor e primeiro pet sem sair do agendamento. */
export function QuickCustomer({
  sizeRanges,
  initialName,
  onCreated,
}: {
  sizeRanges: SizeRanges;
  initialName: string;
  onCreated: (customer: SavedCustomer) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden /> Cadastrar cliente novo
      </Button>
      {open ? (
        <Sheet open onOpenChange={setOpen} title="Cliente novo" wide>
          <QuickCustomerForm
            sizeRanges={sizeRanges}
            initialName={initialName}
            onCreated={(customer) => {
              setOpen(false);
              onCreated(customer);
            }}
          />
        </Sheet>
      ) : null}
    </>
  );
}

function QuickCustomerForm({
  sizeRanges,
  initialName,
  onCreated,
}: {
  sizeRanges: SizeRanges;
  initialName: string;
  onCreated: (customer: SavedCustomer) => void;
}) {
  const [state, action] = useActionState(saveCustomerAction, null);
  useEffect(() => {
    if (state?.ok && state.data) onCreated(state.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Se digitaram um número na busca, ele vira o celular; senão, o nome.
  const looksLikePhone = /\d{4,}/.test(initialName);
  return (
    <ActionForm action={action} className="flex flex-col gap-6" noValidate>
      <ActionFeedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome do tutor" error={fieldError(state, "name")}>
          {(props) => (
            <Input
              {...props}
              name="name"
              defaultValue={looksLikePhone ? "" : initialName}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Celular com WhatsApp" error={fieldError(state, "phone")}>
          {(props) => (
            <Input
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="(19) 98765-4321"
              defaultValue={looksLikePhone ? initialName : ""}
              autoComplete="off"
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-5 border-t border-rejunte pt-5">
        <h3 className="text-lg">Pet</h3>
        <PetFields values={EMPTY_PET} sizeRanges={sizeRanges} state={state} compact />
      </div>
      <div className="border-t border-rejunte pt-5">
        <SubmitButton size="lg" pendingLabel="Cadastrando…">
          Cadastrar e continuar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
