"use client";

import { useActionState, useState } from "react";
import { ActionFeedback } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelAppointmentAction } from "@/server/agenda-actions";

export function CancelAppointment({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelAppointmentAction, null);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Cancelar agendamento
      </Button>
      {open ? (
        <Sheet
          open
          onOpenChange={setOpen}
          title="Cancelar agendamento"
          description="As vagas voltam para a agenda. O histórico fica guardado."
        >
          <ActionForm action={action} className="flex flex-col gap-5">
            <ActionFeedback state={state} />
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <Field label="Motivo" optional>
              {(props) => (
                <Input {...props} name="reason" placeholder="Ex.: tutor remarcou" maxLength={200} />
              )}
            </Field>
            <Checkbox name="notifyCustomer" defaultChecked label="Avisar o tutor pelo WhatsApp" />
            <div className="flex flex-wrap gap-2 border-t border-rejunte pt-5">
              <SubmitButton variant="danger" pendingLabel="Cancelando…">
                Cancelar agendamento
              </SubmitButton>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Voltar
              </Button>
            </div>
          </ActionForm>
        </Sheet>
      ) : null}
    </>
  );
}
