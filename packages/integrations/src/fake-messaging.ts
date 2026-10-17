import { randomUUID } from "node:crypto";
import type { ConnectResult, InstanceInfo, MessagingProvider } from "./messaging";

interface FakeInstance {
  startedAt: number | null;
  pairing: boolean;
}

export interface SentFakeMessage {
  instanceName: string;
  to: string;
  text: string;
  at: Date;
}

/** QR Code ilustrativo para o modo simulado (não é lido por nenhum celular). */
function fakeQrCode(seed: number): string {
  const size = 25;
  let cells = "";
  const origins = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as const;
  // Retorna true/false dentro dos três quadrados de posição e null fora deles.
  const finderCell = (x: number, y: number): boolean | null => {
    for (const [ox, oy] of origins) {
      const lx = x - ox;
      const ly = y - oy;
      if (lx >= 0 && lx < 7 && ly >= 0 && ly < 7) {
        return lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
      }
    }
    return null;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = finderCell(x, y);
      const dark = finder ?? (x * 31 + y * 17 + seed * 7) % 5 < 2;
      if (dark) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${size + 4} ${size + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${size + 4}" height="${size + 4}" fill="#fff"/><g fill="#0e2a3b">${cells}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Simulador para desenvolvimento e testes: mostra um QR Code ilustrativo e "conecta" sozinho depois de
 * alguns segundos. Mensagens enviadas ficam guardadas em memória e aparecem no log do servidor.
 */
export class FakeMessagingProvider implements MessagingProvider {
  readonly kind = "fake" as const;
  private readonly instances = new Map<string, FakeInstance>();
  readonly sent: SentFakeMessage[] = [];

  constructor(private readonly connectAfterMs = 6_000) {}

  private get(instanceName: string): FakeInstance {
    let instance = this.instances.get(instanceName);
    if (!instance) {
      instance = { startedAt: null, pairing: false };
      this.instances.set(instanceName, instance);
    }
    return instance;
  }

  private isOpen(instance: FakeInstance): boolean {
    return instance.startedAt !== null && Date.now() - instance.startedAt >= this.connectAfterMs;
  }

  async ensureInstance(instanceName: string): Promise<void> {
    this.get(instanceName);
  }

  async connect(instanceName: string): Promise<ConnectResult> {
    const instance = this.get(instanceName);
    if (this.isOpen(instance)) return { state: "open", qrCode: null, pairingCode: null, attempt: 0 };
    if (instance.startedAt === null) {
      instance.startedAt = Date.now();
      instance.pairing = false;
    }
    const attempt = Math.floor((Date.now() - instance.startedAt) / 20_000) + 1;
    return { state: "connecting", qrCode: fakeQrCode(attempt), pairingCode: null, attempt };
  }

  async requestPairingCode(instanceName: string): Promise<ConnectResult> {
    const instance = this.get(instanceName);
    if (this.isOpen(instance)) return { state: "open", qrCode: null, pairingCode: null, attempt: 0 };
    instance.startedAt = Date.now();
    instance.pairing = true;
    return { state: "connecting", qrCode: null, pairingCode: "PETS2026", attempt: 1 };
  }

  async getInfo(instanceName: string): Promise<InstanceInfo> {
    const instance = this.get(instanceName);
    if (this.isOpen(instance)) {
      return {
        state: "open",
        phoneNumber: "5519990001234",
        profileName: "Pet shop (simulado)",
        profilePictureUrl: null,
      };
    }
    return {
      state: instance.startedAt === null ? "close" : "connecting",
      phoneNumber: null,
      profileName: null,
      profilePictureUrl: null,
    };
  }

  async logout(instanceName: string): Promise<void> {
    this.instances.set(instanceName, { startedAt: null, pairing: false });
  }

  async sendText(instanceName: string, toDigits: string, text: string): Promise<{ id: string | null }> {
    const instance = this.get(instanceName);
    if (!this.isOpen(instance)) throw new Error("WhatsApp desconectado");
    this.sent.push({ instanceName, to: toDigits, text, at: new Date() });
    console.info(`[whatsapp simulado] ${instanceName} → ${toDigits}: ${text}`);
    return { id: randomUUID() };
  }
}
