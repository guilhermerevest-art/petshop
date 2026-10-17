import { isValidCpf, isValidCnpj, normalizeCnpj } from "./documents";
import { normalizeBrPhone } from "./phone";
import { onlyDigits, toAscii } from "./text";

export const PIX_KEY_TYPES = ["cpf", "cnpj", "email", "phone", "random"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular",
  random: "Chave aleatória",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RANDOM_KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Normaliza a chave PIX no formato que o Banco Central espera. Retorna null se inválida. */
export function normalizePixKey(type: PixKeyType, input: string): string | null {
  const value = input.trim();
  switch (type) {
    case "cpf": {
      const cpf = onlyDigits(value);
      return isValidCpf(cpf) ? cpf : null;
    }
    case "cnpj": {
      const cnpj = normalizeCnpj(value);
      return isValidCnpj(cnpj) ? cnpj : null;
    }
    case "email": {
      const email = value.toLowerCase();
      return EMAIL_RE.test(email) && email.length <= 77 ? email : null;
    }
    case "phone":
      return normalizeBrPhone(value);
    case "random": {
      const key = value.toLowerCase();
      return RANDOM_KEY_RE.test(key) ? key : null;
    }
  }
}

/** Nome do recebedor no BR Code: sem acentos, até 25 caracteres. */
export function normalizeMerchantName(value: string): string {
  return toAscii(value).replace(/\s+/g, " ").trim().slice(0, 25).trim();
}

/** Cidade do recebedor no BR Code: sem acentos, até 15 caracteres. */
export function normalizeMerchantCity(value: string): string {
  return toAscii(value).replace(/\s+/g, " ").trim().slice(0, 15).trim();
}

/** Referência (txid) do PIX estático: até 25 caracteres alfanuméricos. */
export function normalizeTxid(value: string): string {
  const txid = toAscii(value)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 25);
  return txid.length > 0 ? txid : "***";
}

export interface PixPayloadInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  /** Valor em centavos. Omitido ou 0 = o pagador digita o valor. */
  amountCents?: number;
  /** Referência que aparece para o recebedor (ex.: número da comanda). */
  txid?: string;
  /** Mensagem curta exibida ao pagador. */
  description?: string;
}

function field(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Campo ${id} do BR Code excede 99 caracteres`);
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** CRC16-CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), como exige o BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o "PIX copia e cola" estático (BR Code, padrão EMV do Banco Central).
 * O mesmo texto é usado para gerar o QR Code.
 */
export function buildPixPayload(input: PixPayloadInput): string {
  const name = normalizeMerchantName(input.merchantName);
  const city = normalizeMerchantCity(input.merchantCity);
  if (!input.key) throw new Error("Chave PIX obrigatória");
  if (!name) throw new Error("Nome do recebedor obrigatório");
  if (!city) throw new Error("Cidade do recebedor obrigatória");

  const gui = field("00", "br.gov.bcb.pix");
  const key = field("01", input.key);
  let account = gui + key;
  const description = input.description ? toAscii(input.description).trim() : "";
  if (description) {
    const room = 99 - account.length - 4;
    if (room > 0) account += field("02", description.slice(0, room));
  }

  let payload =
    field("00", "01") + field("26", account) + field("52", "0000") + field("53", "986");

  if (input.amountCents && input.amountCents > 0) {
    if (!Number.isInteger(input.amountCents)) throw new Error("Valor deve estar em centavos");
    payload += field("54", (input.amountCents / 100).toFixed(2));
  }

  payload +=
    field("58", "BR") +
    field("59", name) +
    field("60", city) +
    field("62", field("05", normalizeTxid(input.txid ?? "")));

  payload += "6304";
  return payload + crc16(payload);
}
