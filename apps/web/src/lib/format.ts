const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export const formatDate = (date: Date) => dateFormat.format(date);
export const formatShortDate = (date: Date) => shortDate.format(date);
export const formatDateTime = (date: Date) => dateTime.format(date);

export function formatInterval(interval: string | null | undefined): string {
  return interval === "year" ? "por ano" : "por mês";
}

/** "sexta-feira, 23 de outubro" → "Sexta-feira, 23 de outubro" */
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
