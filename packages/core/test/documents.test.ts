import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj, isValidCpf, parseDocument } from "../src/documents";
import { formatBrPhone, normalizeBrPhone } from "../src/phone";
import { slugify, isValidSlug } from "../src/text";
import { formatBRL, parseBRL } from "../src/money";

describe("documentos", () => {
  it("valida CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("000.000.000-00")).toBe(false);
  });

  it("valida CNPJ numérico e alfanumérico", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-36")).toBe(false);
    expect(formatCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });

  it("identifica CPF ou CNPJ", () => {
    expect(parseDocument("529.982.247-25")).toEqual({ kind: "cpf", value: "52998224725" });
    expect(parseDocument("11222333000181")).toEqual({ kind: "cnpj", value: "11222333000181" });
    expect(parseDocument("123")).toBeNull();
  });
});

describe("telefone", () => {
  it("normaliza para E.164", () => {
    expect(normalizeBrPhone("(19) 98765-4321")).toBe("+5519987654321");
    expect(normalizeBrPhone("+55 19 98765-4321")).toBe("+5519987654321");
    expect(normalizeBrPhone("019 3234-5678")).toBe("+551932345678");
    expect(normalizeBrPhone("19 8765-4321")).toBeNull();
    expect(normalizeBrPhone("123")).toBeNull();
  });

  it("formata para exibição", () => {
    expect(formatBrPhone("+5519987654321")).toBe("(19) 98765-4321");
    expect(formatBrPhone("+551932345678")).toBe("(19) 3234-5678");
  });
});

describe("textos e valores", () => {
  it("gera endereço do pet shop", () => {
    expect(slugify("Pet Shop São João & Cia.")).toBe("pet-shop-sao-joao-cia");
    expect(isValidSlug("pet-shop-sao-joao")).toBe(true);
    expect(isValidSlug("admin")).toBe(false);
  });

  it("converte reais em centavos", () => {
    expect(parseBRL("50")).toBe(5000);
    expect(parseBRL("50,5")).toBe(5050);
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 90,00")).toBe(9000);
    expect(parseBRL("1.500")).toBe(150000);
    expect(parseBRL("abc")).toBeNull();
    expect(formatBRL(9050).replace(/\s/g, " ")).toBe("R$ 90,50");
  });
});
