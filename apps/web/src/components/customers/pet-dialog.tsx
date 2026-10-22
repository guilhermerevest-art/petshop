"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { SizeRanges } from "@petshop/core";
import { ActionButton } from "@/components/action-button";
import { ActionFeedback } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { archivePetAction, savePetAction } from "@/server/customer-actions";
import { EMPTY_PET, PetFields, type PetValues } from "./pet-fields";

export function PetDialog({
  customerId,
  pet,
  sizeRanges,
  label,
  variant = "secondary",
  onSaved,
}: {
  customerId: string;
  pet?: PetValues & { id: string };
  sizeRanges: SizeRanges;
  label?: string;
  variant?: ButtonVariant;
  /** Chamado com o id do pet depois de salvar (ex.: para já selecioná-lo no agendamento). */
  onSaved?: (petId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={pet ? "sm" : "md"} onClick={() => setOpen(true)}>
        {pet ? null : <Plus className="size-4" aria-hidden />}
        {label ?? (pet ? "Editar" : "Adicionar pet")}
      </Button>
      {open ? (
        <Sheet open onOpenChange={setOpen} title={pet ? `Editar ${pet.name}` : "Novo pet"} wide>
          <PetForm
            customerId={customerId}
            pet={pet}
            sizeRanges={sizeRanges}
            onDone={(petId) => {
              setOpen(false);
              onSaved?.(petId);
            }}
          />
        </Sheet>
      ) : null}
    </>
  );
}

function PetForm({
  customerId,
  pet,
  sizeRanges,
  onDone,
}: {
  customerId: string;
  pet?: PetValues & { id: string };
  sizeRanges: SizeRanges;
  onDone: (petId: string) => void;
}) {
  const [state, action] = useActionState(savePetAction, null);
  useEffect(() => {
    if (state?.ok && state.data) onDone(state.data.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={action} className="flex flex-col gap-6" noValidate>
        <ActionFeedback state={state} />
        <input type="hidden" name="customerId" value={customerId} />
        {pet ? <input type="hidden" name="id" value={pet.id} /> : null}
        <PetFields values={pet ?? EMPTY_PET} sizeRanges={sizeRanges} state={state} />
        <div className="border-t border-rejunte pt-5">
          <SubmitButton size="lg" pendingLabel="Salvando…">
            {pet ? "Salvar pet" : "Cadastrar pet"}
          </SubmitButton>
        </div>
      </ActionForm>
      {pet ? (
        <details className="border-t border-rejunte pt-4">
          <summary className="cursor-pointer text-sm text-tinta-suave hover:text-alerta">
            Remover este pet
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[15px] text-tinta-suave">
              O pet sai da ficha e da lista de agendamento. O histórico dos atendimentos continua
              guardado.
            </p>
            <ActionButton
              action={archivePetAction}
              hidden={{ id: pet.id }}
              variant="danger"
              size="sm"
              pendingLabel="Removendo…"
            >
              Remover {pet.name}
            </ActionButton>
          </div>
        </details>
      ) : null}
    </div>
  );
}
