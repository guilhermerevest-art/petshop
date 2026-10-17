export type ConnectionState = "open" | "connecting" | "close";

export interface InstanceInfo {
  state: ConnectionState;
  /** Número conectado, só dígitos com DDI (ex.: 5519987654321). */
  phoneNumber: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
}

export interface ConnectResult {
  state: ConnectionState;
  /** Imagem do QR Code (data URL), quando aguardando leitura. */
  qrCode: string | null;
  /** Código de 8 caracteres para digitar no celular, quando pedido por número. */
  pairingCode: string | null;
  /** Quantos QR Codes já foram gerados nesta tentativa. */
  attempt: number;
}

export interface EnsureInstanceOptions {
  /** Endereço que recebe os eventos (conexão, mensagens, status de entrega). */
  webhookUrl?: string | null;
}

/** Envio e conexão de WhatsApp. Implementado pela Evolution API e por um simulador para desenvolvimento. */
export interface MessagingProvider {
  readonly kind: "evolution" | "fake";
  ensureInstance(instanceName: string, options?: EnsureInstanceOptions): Promise<void>;
  /** Inicia (ou continua) a conexão por QR Code. */
  connect(instanceName: string): Promise<ConnectResult>;
  /** Inicia a conexão por código de pareamento para o número informado (só dígitos, com DDI). */
  requestPairingCode(instanceName: string, phoneDigits: string): Promise<ConnectResult>;
  getInfo(instanceName: string): Promise<InstanceInfo>;
  logout(instanceName: string): Promise<void>;
  sendText(instanceName: string, toDigits: string, text: string): Promise<{ id: string | null }>;
}

export class MessagingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

/** Formata o código de pareamento para leitura: ABCD1234 → ABCD-1234. */
export function formatPairingCode(code: string | null): string | null {
  if (!code) return null;
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
