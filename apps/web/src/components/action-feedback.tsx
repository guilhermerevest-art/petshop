"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import { Notice } from "./ui/notice";

/** Mostra o aviso de sucesso (toast) e o erro geral do formulário. */
export function ActionFeedback({ state }: { state: ActionResult<unknown> | null }) {
  const last = useRef<ActionResult<unknown> | null>(null);
  useEffect(() => {
    if (state && state !== last.current && state.ok && state.message) toast.success(state.message);
    last.current = state;
  }, [state]);
  if (!state || state.ok) return null;
  return <Notice tone="error">{state.message}</Notice>;
}

export function fieldError(state: ActionResult<unknown> | null, field: string): string | undefined {
  if (!state || state.ok) return undefined;
  return state.fieldErrors?.[field];
}
