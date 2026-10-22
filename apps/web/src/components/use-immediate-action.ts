"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * Para formulários que somem (ou recomeçam) depois do sucesso: o aviso sai na hora pelo toast,
 * e só o erro fica guardado para mostrar no formulário.
 */
export function useImmediateAction<T>(
  serverAction: (state: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>,
) {
  const [state, setState] = useState<ActionResult<T> | null>(null);
  const run = async (formData: FormData) => {
    const result = await serverAction(null, formData);
    if (result.ok) {
      setState(null);
      if (result.message) toast.success(result.message);
    } else setState(result);
  };
  return [state, run] as const;
}
