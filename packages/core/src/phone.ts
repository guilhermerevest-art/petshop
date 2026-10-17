import { onlyDigits } from "./text";

/**
 * Normaliza um telefone brasileiro para E.164 (+55DDNNNNNNNNN).
 * Aceita com ou sem DDI, com máscara ou não. Retorna null se não for um número válido.
 */
export function normalizeBrPhone(input: string): string | null {
  let digits = onlyDigits(input);
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!/^[1-9][1-9]$/.test(ddd)) return null;
  if (number.length === 9 && !number.startsWith("9")) return null;
  if (number.length === 8 && !/^[2-5]/.test(number)) return null;

  return `+55${ddd}${number}`;
}

/** Formato de exibição: (11) 98765-4321 ou (11) 3456-7890. */
export function formatBrPhone(e164: string): string {
  const digits = onlyDigits(e164).replace(/^55/, "");
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length === 9) return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return e164;
}

/** Número no formato aceito pela API do WhatsApp (só dígitos, com DDI). */
export function toWhatsAppNumber(e164: string): string {
  return onlyDigits(e164);
}
