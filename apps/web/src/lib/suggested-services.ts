import type { Size } from "@petshop/core";

type Category = "banho" | "tosa" | "estetica" | "saude" | "outros";

export interface SuggestedService {
  key: string;
  name: string;
  category: Category;
  description: string | null;
  isAddon: boolean;
  prices: { size: Size; priceCents: number; durationMinutes: number }[];
}

const table = (rows: [Size, number, number][]) =>
  rows.map(([size, reais, durationMinutes]) => ({ size, priceCents: reais * 100, durationMinutes }));

/** Ponto de partida editável: preços e tempos médios de banho e tosa no interior de SP (2026). */
export const SUGGESTED_SERVICES: SuggestedService[] = [
  {
    key: "banho",
    name: "Banho",
    category: "banho",
    description: "Banho, secagem, escovação, corte de unhas e limpeza de ouvidos.",
    isAddon: false,
    prices: table([["P", 50, 60], ["M", 65, 75], ["G", 85, 90], ["GG", 110, 120]]),
  },
  {
    key: "banho-tosa-higienica",
    name: "Banho e tosa higiênica",
    category: "tosa",
    description: "Banho completo com tosa das patas, barriga e região íntima.",
    isAddon: false,
    prices: table([["P", 65, 75], ["M", 80, 90], ["G", 100, 105], ["GG", 130, 135]]),
  },
  {
    key: "tosa-maquina",
    name: "Banho e tosa na máquina",
    category: "tosa",
    description: null,
    isAddon: false,
    prices: table([["P", 85, 90], ["M", 105, 105], ["G", 130, 120], ["GG", 160, 150]]),
  },
  {
    key: "tosa-tesoura",
    name: "Banho e tosa na tesoura",
    category: "tosa",
    description: null,
    isAddon: false,
    prices: table([["P", 110, 120], ["M", 135, 135], ["G", 160, 150], ["GG", 200, 180]]),
  },
  {
    key: "hidratacao",
    name: "Hidratação",
    category: "estetica",
    description: "Adicional ao banho.",
    isAddon: true,
    prices: table([["P", 25, 15], ["M", 30, 15], ["G", 35, 20], ["GG", 40, 20]]),
  },
  {
    key: "desembolo",
    name: "Desembolo",
    category: "estetica",
    description: "Remoção de nós. Adicional ao banho.",
    isAddon: true,
    prices: table([["P", 30, 30], ["M", 40, 30], ["G", 50, 45], ["GG", 60, 45]]),
  },
  {
    key: "escovacao-dental",
    name: "Escovação dental",
    category: "saude",
    description: "Adicional ao banho.",
    isAddon: true,
    prices: table([["P", 20, 10], ["M", 20, 10], ["G", 25, 10], ["GG", 25, 10]]),
  },
];
