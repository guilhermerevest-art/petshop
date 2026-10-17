"use client";

import { useFormStatus } from "react-dom";
import { useActionFormPending } from "./action-form";
import { Button, type ButtonProps } from "./button";
import { Spinner } from "./spinner";

/** Botão de envio que mostra andamento e evita clique duplo. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const formPending = useActionFormPending();
  const { pending: nativePending } = useFormStatus();
  const pending = formPending ?? nativePending;
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <Spinner /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
