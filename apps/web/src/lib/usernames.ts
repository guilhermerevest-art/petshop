import { toAscii } from "@petshop/core";

/** Usuário de login da equipe: letras minúsculas, números, ponto e sublinhado. */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;

/** Domínio reservado (.invalid, RFC 2606) para o e-mail interno de quem entra só com usuário. */
export const STAFF_EMAIL_DOMAIN = "equipe.petshop.invalid";

export function staffEmail(username: string): string {
  return `${username}@${STAFF_EMAIL_DOMAIN}`;
}

export function isStaffEmail(email: string): boolean {
  return email.endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}

export function normalizeUsername(value: string): string {
  return toAscii(value).trim().toLowerCase().replace(/\s+/g, ".");
}

/** Sugestão de usuário: primeiro nome + nome curto do pet shop (ex.: bruno.bombanho). */
export function suggestUsername(name: string, shopSlug: string): string {
  const first = normalizeUsername(name.split(" ")[0] ?? "").replace(/[^a-z0-9]/g, "");
  if (!first) return "";
  const shop = shopSlug
    .replace(/^pet-?shop-?/, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 14);
  return [first, shop].filter(Boolean).join(".").slice(0, 30);
}

/** Senha provisória fácil de ditar: 3 palavras curtas + 2 dígitos (ex.: banho-pente-laco-42). */
export function generatePassword(): string {
  const words = [
    "banho",
    "tosa",
    "pente",
    "laco",
    "patas",
    "pelo",
    "osso",
    "toalha",
    "bolha",
    "cheiro",
    "escova",
    "bandana",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)]!;
  const digits = String(Math.floor(Math.random() * 90) + 10);
  return `${pick()}-${pick()}-${pick()}-${digits}`;
}
