import { describe, expect, it } from "vitest";
import { confirmationMessage, reminderMessage } from "../src/messages";

describe("mensagens para o tutor", () => {
  it("confirmação com data, hora, pets e valor", () => {
    const text = confirmationMessage({
      shopName: "Pet Shop Bom Banho",
      customerName: "Carla Dias",
      dateLabel: "quinta-feira, 22 de outubro",
      startMinutes: 540,
      pets: [{ name: "Thor", services: ["Banho", "Hidratação"] }],
      totalCents: 7500,
    });
    expect(text).toContain("Olá, Carla!");
    expect(text).toContain("quinta-feira, 22 de outubro, às 09:00");
    expect(text).toContain("Thor (Banho, Hidratação)");
    expect(text.replace(/\s/g, " ")).toContain("Valor: R$ 75,00");
  });

  it("lembrete junta os nomes dos pets", () => {
    expect(
      reminderMessage({
        shopName: "X",
        customerName: "Ana",
        startMinutes: 600,
        pets: [
          { name: "Mel", services: [] },
          { name: "Bidu", services: [] },
        ],
      }),
    ).toContain("amanhã às 10:00 tem Mel e Bidu");
  });
});
