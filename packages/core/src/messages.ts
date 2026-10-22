import { formatBRL } from "./money";
import { formatTime } from "./time";

/** Textos das mensagens automáticas para o tutor. Curtos, claros e com o nome do pet. */

export interface MessagePet {
  name: string;
  services: string[];
}

function petsLine(pets: MessagePet[]): string {
  return pets.map((p) => `${p.name} (${p.services.join(", ")})`).join("\n");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function confirmationMessage(input: {
  shopName: string;
  customerName: string;
  dateLabel: string;
  startMinutes: number;
  pets: MessagePet[];
  totalCents?: number | null;
}): string {
  const lines = [
    `Olá, ${firstName(input.customerName)}! Agendamento confirmado no ${input.shopName}.`,
    "",
    `📅 ${input.dateLabel}, às ${formatTime(input.startMinutes)}`,
    petsLine(input.pets),
  ];
  if (input.totalCents) lines.push(`Valor: ${formatBRL(input.totalCents)}`);
  lines.push("", "Se precisar mudar, é só responder esta mensagem.");
  return lines.join("\n");
}

export function reminderMessage(input: {
  shopName: string;
  customerName: string;
  startMinutes: number;
  pets: MessagePet[];
}): string {
  const names = input.pets.map((p) => p.name).join(" e ");
  return [
    `Olá, ${firstName(input.customerName)}! Lembrete: amanhã às ${formatTime(input.startMinutes)} tem ${names} aqui no ${input.shopName}. 🐾`,
    "",
    "Se não puder vir, responda esta mensagem para remarcarmos.",
  ].join("\n");
}

export function checkInMessage(input: { shopName: string; petName: string }): string {
  return `Recebemos ${input.petName} aqui no ${input.shopName}. 🐶 Avisamos assim que estiver pronto!`;
}

export function readyMessage(input: { shopName: string; petName: string }): string {
  return `${input.petName} está pronto para buscar no ${input.shopName}! 🛁✨`;
}

export function cancellationMessage(input: {
  shopName: string;
  customerName: string;
  dateLabel: string;
  startMinutes: number;
}): string {
  return `Olá, ${firstName(input.customerName)}. O agendamento de ${input.dateLabel}, às ${formatTime(input.startMinutes)}, no ${input.shopName} foi cancelado. Para marcar outro horário, é só responder esta mensagem.`;
}

/** Cobrança por PIX: valor e o "copia e cola" numa mensagem separada, fácil de copiar no celular. */
export function pixChargeMessages(input: {
  shopName: string;
  customerName: string;
  totalCents: number;
  payload: string;
}): [string, string] {
  return [
    `Olá, ${firstName(input.customerName)}! Segue o PIX de ${formatBRL(input.totalCents)} do ${input.shopName}. Copie o código da próxima mensagem e cole no app do seu banco, em "PIX copia e cola".`,
    input.payload,
  ];
}

export function receiptMessage(input: {
  shopName: string;
  customerName: string;
  number: number;
  totalCents: number;
  url: string;
}): string {
  return [
    `Obrigado, ${firstName(input.customerName)}! Recebemos ${formatBRL(input.totalCents)} no ${input.shopName}. 💚`,
    "",
    `Recibo da comanda ${input.number}: ${input.url}`,
  ].join("\n");
}
