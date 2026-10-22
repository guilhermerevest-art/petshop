"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { ActionForm } from "./ui/action-form";
import type { ButtonSize, ButtonVariant } from "./ui/button";
import { Notice } from "./ui/notice";
import { SubmitButton } from "./ui/submit-button";

/**
 * Botão que dispara uma Server Action sem campos, com andamento e mensagem de erro.
 * O aviso de sucesso sai na hora, mesmo que o botão desapareça da tela (ex.: remover um item da lista).
 */
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
  const [error, setError] = useState<string | null>(null);
  return (
    <ActionForm
      action={async (formData) => {
        const result = await action(null, formData);
        if (!result) return;
        if (result.ok) {
          setError(null);
          if (result.message) toast.success(result.message);
        } else {
          setError(result.message);
        }
      }}
      className="flex flex-col gap-3"
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}
