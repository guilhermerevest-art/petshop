import type { PetStatus } from "@petshop/db/schema";

export const PET_STATUS_LABELS: Record<PetStatus, string> = {
  agendado: "Agendado",
  check_in: "Chegou",
  em_atendimento: "Em atendimento",
  pronto: "Pronto",
  concluido: "Entregue",
  cancelado: "Cancelado",
  nao_compareceu: "Não veio",
};

/** Próximo passo de cada status na fila do dia (botão principal). */
export const NEXT_STATUS: Partial<Record<PetStatus, { to: PetStatus; label: string }>> = {
  agendado: { to: "check_in", label: "Registrar chegada" },
  check_in: { to: "em_atendimento", label: "Começar atendimento" },
  em_atendimento: { to: "pronto", label: "Marcar como pronto" },
  pronto: { to: "concluido", label: "Entregar ao tutor" },
};

export function statusTone(status: PetStatus): "neutral" | "ok" | "attention" | "danger" {
  if (status === "pronto") return "attention";
  if (status === "cancelado" || status === "nao_compareceu") return "danger";
  if (status === "concluido") return "neutral";
  return "ok";
}
