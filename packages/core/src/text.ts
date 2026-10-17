/** Remove acentos e caracteres fora do ASCII imprimível. */
export function toAscii(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assinatura",
  "ajuda",
  "blog",
  "contato",
  "convite",
  "criar-conta",
  "entrar",
  "mail",
  "portal",
  "status",
  "suporte",
  "www",
]);

/** Gera um endereço curto e legível a partir do nome do pet shop. */
export function slugify(value: string): string {
  return toAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !isReservedSlug(slug);
}
