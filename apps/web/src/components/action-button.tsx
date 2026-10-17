"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { ActionFeedback } from "./action-feedback";
import type { ButtonSize, ButtonVariant } from "./ui/button";
import { SubmitButton } from "./ui/submit-button";

/** Botão que dispara uma Server Action sem campos, com andamento e mensagem de erro. */
export function ActionButton({
  action,
  children,
  pendingLabel,
  variant,
  size,
  hidden,
}: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ActionFeedback state={state} />
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
    </form>
  );
}
