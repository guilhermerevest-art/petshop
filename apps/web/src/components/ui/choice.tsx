"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

/** Grupo de opções em cartões grandes (fácil no toque). Usa rádio nativo por baixo. */
export function ChoiceCards<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = 2,
  legend,
}: {
  name: string;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange?: (value: T) => void;
  columns?: 2 | 3 | 4 | 5;
  legend?: ReactNode;
}) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }[columns];
  return (
    <fieldset>
      {legend ? <legend className="mb-1.5 text-[15px] font-medium">{legend}</legend> : null}
      <div className={cn("grid grid-cols-1 gap-2", grid)}>
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex cursor-pointer flex-col gap-0.5 rounded-campo border bg-white px-4 py-3 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-tinta",
                checked ? "border-azulejo bg-azulejo-claro/50 ring-1 ring-azulejo" : "border-rejunte-forte hover:border-tinta-suave",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange?.(option.value)}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              {option.description ? <span className="text-sm text-tinta-suave">{option.description}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Interruptor liga/desliga acessível (checkbox por baixo). */
export function Switch({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  name?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 select-none">
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tinta",
          checked ? "border-azulejo bg-azulejo" : "border-rejunte-forte bg-rejunte",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-[22px] rounded-full bg-white shadow-[0_1px_2px_rgba(16,41,58,0.3)] transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="text-[15px]">{label}</span>
    </label>
  );
}

export function Checkbox({
  name,
  value,
  label,
  defaultChecked,
  checked,
  onChange,
  required,
}: {
  name: string;
  value?: string;
  label: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        required={required}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-azulejo"
      />
      <span className="text-[15px]">{label}</span>
    </label>
  );
}
