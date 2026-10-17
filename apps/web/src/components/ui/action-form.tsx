"use client";

import { createContext, useContext, useTransition, type FormHTMLAttributes } from "react";

const PendingContext = createContext<boolean | null>(null);

/** Indica se o formulário de ação mais próximo está enviando. */
export function useActionFormPending(): boolean | null {
  return useContext(PendingContext);
}

/**
 * Formulário que chama uma Server Action sem apagar os campos quando a resposta é um erro
 * (o `<form action>` do React 19 limpa os campos depois de cada envio).
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (formData: FormData) => unknown;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <PendingContext value={pending}>
      <form
        {...props}
        aria-busy={pending || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const formData = new FormData(event.currentTarget);
          startTransition(async () => {
            await action(formData);
          });
        }}
      >
        {children}
      </form>
    </PendingContext>
  );
}
