import { onlyDigits } from "./text";

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i]! * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

/** Mantém letras maiúsculas e dígitos: o CNPJ alfanumérico existe desde julho de 2026. */
export function normalizeCnpj(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Valida CNPJ numérico e alfanumérico (IN RFB 2.229/2024): os 12 primeiros caracteres
 * podem ser letras ou dígitos (valor = código ASCII − 48) e os 2 últimos são dígitos verificadores.
 */
export function isValidCnpj(input: string): boolean {
  const cnpj = normalizeCnpj(input);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const values = cnpj.split("").map((char) => char.charCodeAt(0) - 48);
  const check = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += values[i]! * weights[i]!;
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === values[12] && check(13) === values[13];
}

export function formatCpf(input: string): string {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return input;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export function formatCnpj(input: string): string {
  const cnpj = normalizeCnpj(input);
  if (cnpj.length !== 14) return input;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export type DocumentKind = "cpf" | "cnpj";

/** Identifica e normaliza CPF ou CNPJ. Retorna null se inválido. */
export function parseDocument(input: string): { kind: DocumentKind; value: string } | null {
  const cnpj = normalizeCnpj(input);
  if (cnpj.length === 11 && /^\d+$/.test(cnpj) && isValidCpf(cnpj)) {
    return { kind: "cpf", value: cnpj };
  }
  if (cnpj.length === 14 && isValidCnpj(cnpj)) return { kind: "cnpj", value: cnpj };
  return null;
}

export function formatDocument(value: string): string {
  return value.length === 11 ? formatCpf(value) : formatCnpj(value);
}
