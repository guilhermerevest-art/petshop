import { z } from "zod";
import { sizeForWeight, type Size, type SizeRanges } from "@petshop/core";

export const SPECIES_LABELS = { cao: "Cão", gato: "Gato", outro: "Outro" } as const;
export const COAT_LABELS = { curta: "Curta", media: "Média", longa: "Longa" } as const;
export const SEX_LABELS = { macho: "Macho", femea: "Fêmea" } as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

/** Campos do pet vindos de um formulário (prefixo opcional, ex.: "pet." no cadastro rápido). */
export function petSchema(sizeRanges: SizeRanges) {
  return z
    .object({
      name: z.string().trim().min(1, "Digite o nome do pet.").max(60),
      species: z.enum(["cao", "gato", "outro"]).default("cao"),
      breed: optionalText(60),
      sex: z
        .enum(["macho", "femea", ""])
        .optional()
        .transform((v) => (v ? v : null)),
      birthDate: z
        .string()
        .optional()
        .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
      weightKg: z
        .string()
        .optional()
        .transform((v, ctx) => {
          if (!v || !v.trim()) return null;
          const n = Number(v.replace(",", "."));
          if (!Number.isFinite(n) || n <= 0 || n > 150) {
            ctx.addIssue({ code: "custom", message: "Digite o peso em kg, por exemplo 8,5." });
            return z.NEVER;
          }
          return Math.round(n * 100) / 100;
        }),
      size: z
        .enum(["P", "M", "G", "GG", ""])
        .optional()
        .transform((v) => (v ? (v as Size) : null)),
      coat: z
        .enum(["curta", "media", "longa", ""])
        .optional()
        .transform((v) => (v ? v : null)),
      neutered: z
        .enum(["sim", "nao", ""])
        .optional()
        .transform((v) => (v === "sim" ? true : v === "nao" ? false : null)),
      color: optionalText(40),
      temperament: optionalText(300),
      allergies: optionalText(300),
      restrictions: optionalText(300),
      notes: optionalText(1000),
      bathFrequencyDays: z
        .string()
        .optional()
        .transform((v) => {
          const n = Number(v);
          return v && Number.isInteger(n) && n > 0 && n <= 180 ? n : null;
        }),
    })
    .transform((pet, ctx) => {
      const size = pet.size ?? (pet.weightKg ? sizeForWeight(pet.weightKg, sizeRanges) : null);
      if (!size) {
        ctx.addIssue({
          code: "custom",
          path: ["size"],
          message: "Escolha o porte ou informe o peso.",
        });
        return z.NEVER;
      }
      return { ...pet, size };
    });
}

/** Lê do FormData só os campos com o prefixo dado ("pet." → "name", "species"…). */
export function fieldsWithPrefix(formData: FormData, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix) && typeof value === "string")
      result[key.slice(prefix.length)] = value;
  }
  return result;
}

/** Idade legível: "3 anos", "8 meses". */
export function formatAge(birthDate: string | null, now = new Date()): string | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months--;
  if (months < 0) return null;
  if (months < 12) return months <= 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
}

/** Tem algo que a equipe precisa saber antes de pegar o pet? */
export function hasAlerts(pet: {
  temperament: string | null;
  allergies: string | null;
  restrictions: string | null;
}) {
  return Boolean(pet.temperament || pet.allergies || pet.restrictions);
}
