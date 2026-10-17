import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

const tones = {
  info: { box: "bg-azulejo-claro/60 border-azulejo/20", icon: Info, iconClass: "text-azulejo" },
  success: { box: "bg-azulejo-claro border-azulejo/30", icon: CheckCircle2, iconClass: "text-azulejo" },
  warning: { box: "bg-patinho-claro border-patinho/50", icon: AlertTriangle, iconClass: "text-[#8a5a00]" },
  error: { box: "bg-alerta-claro border-alerta/30", icon: AlertTriangle, iconClass: "text-alerta" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-campo border px-4 py-3.5", t.box, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", t.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("text-[15px]", title ? "mt-0.5 text-tinta-suave" : "")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
