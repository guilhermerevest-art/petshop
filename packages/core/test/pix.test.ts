import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16, normalizePixKey, normalizeTxid } from "../src/pix";

describe("BR Code (PIX estático)", () => {
  it("reproduz o exemplo do manual do Banco Central", () => {
    const payload = buildPixPayload({
      key: "123e4567-e12b-12d1-a456-426655440000",
      merchantName: "Fulano de Tal",
      merchantCity: "BRASILIA",
    });
    expect(payload).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("inclui valor, referência e remove acentos", () => {
    const payload = buildPixPayload({
      key: "+5519987654321",
      merchantName: "Pet Shop São João",
      merchantCity: "Campinas",
      amountCents: 9050,
      txid: "comanda-123",
    });
    expect(payload).toContain("540590.50");
    expect(payload).toContain("5917Pet Shop Sao Joao");
    expect(payload).toContain("6008Campinas");
    expect(payload).toContain("62140510comanda123");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("corta nome e cidade nos limites do padrão", () => {
    const payload = buildPixPayload({
      key: "a@b.co",
      merchantName: "Nome muito comprido de pet shop que passa",
      merchantCity: "Sao Jose dos Campos",
    });
    expect(payload).toContain("5925Nome muito comprido de pe");
    expect(payload).toContain("6015Sao Jose dos Ca");
  });

  it("normaliza e valida chaves", () => {
    expect(normalizePixKey("cpf", "529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey("cpf", "111.111.111-11")).toBeNull();
    expect(normalizePixKey("cnpj", "11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizePixKey("email", " Loja@Exemplo.com.br ")).toBe("loja@exemplo.com.br");
    expect(normalizePixKey("phone", "(19) 98765-4321")).toBe("+5519987654321");
    expect(normalizePixKey("random", "123E4567-E12B-12D1-A456-426655440000")).toBe(
      "123e4567-e12b-12d1-a456-426655440000",
    );
    expect(normalizePixKey("random", "não é chave")).toBeNull();
  });

  it("usa *** quando não há referência", () => {
    expect(normalizeTxid("")).toBe("***");
    expect(normalizeTxid("Comanda #45")).toBe("Comanda45");
  });
});
