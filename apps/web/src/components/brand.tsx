import { cn } from "@/lib/cn";

/** Marca: quatro azulejos, um deles amarelo (o pet que acabou de ficar pronto). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={cn("size-7", className)}>
      <rect x="1" y="1" width="12" height="12" rx="3" fill="#0a6b67" />
      <rect x="15" y="1" width="12" height="12" rx="3" fill="#0a6b67" />
      <rect x="1" y="15" width="12" height="12" rx="3" fill="#0a6b67" />
      <rect x="15" y="15" width="12" height="12" rx="3" fill="#f5b82e" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[19px] font-[650] tracking-tight text-tinta",
        className,
      )}
    >
      <BrandMark />
      PetShop
    </span>
  );
}
