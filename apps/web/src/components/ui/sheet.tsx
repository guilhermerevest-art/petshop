"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Janela que sobe de baixo no celular e aparece centralizada no computador. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-tinta/30" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-painel bg-white",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-painel",
            wide ? "sm:w-[min(760px,94vw)]" : "sm:w-[min(600px,94vw)]",
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rejunte bg-white px-5 py-4 sm:px-6">
            <Dialog.Title className="text-xl font-[650]">{title}</Dialog.Title>
            <Dialog.Close
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-campo hover:bg-espuma"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description
            className={description ? "px-5 pt-4 text-tinta-suave sm:px-6" : "sr-only"}
          >
            {description ?? title}
          </Dialog.Description>
          <div className="px-5 py-5 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
