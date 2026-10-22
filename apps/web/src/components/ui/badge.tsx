import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-espuma text-tinta-suave border-rejunte",
  ok: "bg-azulejo-claro text-azulejo-escuro border-azulejo/20",
  attention: "bg-patinho-claro text-[#7a4f00] border-patinho/50",
  danger: "bg-alerta-claro text-alerta border-alerta/25",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
