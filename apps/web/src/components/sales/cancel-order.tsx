"use client";

import { useActionState, useState } from "react";
import { ActionFeedback } from "@/components/action-feedback";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { cancelOrderAction } from "@/server/sales-actions";

export function CancelOrder({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelOrderAction, null);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Cancelar comanda
      </Button>
      {open ? (
        <Sheet
          open
          onOpenChange={setOpen}
          title="Cancelar comanda"
          description="Os itens não serão cobrados. O registro fica guardado."
        >
          <ActionForm action={action} className="flex flex-col gap-5">
            <ActionFeedback state={state} />
            <input type="hidden" name="orderId" value={orderId} />
            <Field label="Motivo" optional>
              {(props) => <Input {...props} name="reason" maxLength={200} />}
            </Field>
            <div className="flex gap-2 border-t border-rejunte pt-5">
              <SubmitButton variant="danger" pendingLabel="Cancelando…">
                Cancelar comanda
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
