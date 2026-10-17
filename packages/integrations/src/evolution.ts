import {
  type ConnectResult,
  type ConnectionState,
  type EnsureInstanceOptions,
  type InstanceInfo,
  MessagingError,
  type MessagingProvider,
} from "./messaging";

/** Eventos que o sistema precisa receber da Evolution API. */
export const EVOLUTION_WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
] as const;

export interface EvolutionConfig {
  baseUrl: string;
  /** Chave global da Evolution (AUTHENTICATION_API_KEY). Nunca enviar ao navegador. */
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type Json = Record<string, unknown>;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function asState(value: unknown): ConnectionState {
  return value === "open" || value === "connecting" ? value : "close";
}

function digitsFromJid(jid: unknown): string | null {
  if (typeof jid !== "string" || !jid) return null;
  return jid.split("@")[0]?.split(":")[0] ?? null;
}

/**
 * Cliente da Evolution API v2 (testado contra o código-fonte da versão 2.3.x).
 * Uma instância por pet shop, conectada por QR Code (Baileys).
 */
export class EvolutionProvider implements MessagingProvider {
  readonly kind = "evolution" as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: EvolutionConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetch ?? fetch;
  }

  private async request<T = Json>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    { allowStatus = [] as number[] } = {},
  ): Promise<{ status: number; data: T | null }> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { apikey: this.config.apiKey, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok && !allowStatus.includes(response.status)) {
      throw new MessagingError(
        `Evolution API respondeu ${response.status} em ${method} ${path}`,
        response.status,
        data,
      );
    }
    if (data && typeof data === "object" && (data as Json).error === true) {
      throw new MessagingError(String((data as Json).message ?? "Erro na Evolution API"), response.status, data);
    }
    return { status: response.status, data: data as T };
  }

  private webhookConfig(url: string) {
    return {
      enabled: true,
      url,
      byEvents: false,
      base64: false,
      events: [...EVOLUTION_WEBHOOK_EVENTS],
    };
  }

  async ensureInstance(instanceName: string, options: EnsureInstanceOptions = {}): Promise<void> {
    const name = encodeURIComponent(instanceName);
    const existing = await this.request<unknown[]>("GET", `/instance/fetchInstances?instanceName=${name}`, undefined, {
      allowStatus: [404],
    });
    const exists = existing.status !== 404 && Array.isArray(existing.data) && existing.data.length > 0;

    if (!exists) {
      await this.request("POST", "/instance/create", {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: false,
        groupsIgnore: true,
        rejectCall: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
        ...(options.webhookUrl ? { webhook: this.webhookConfig(options.webhookUrl) } : {}),
      });
    } else if (options.webhookUrl) {
      await this.request("POST", `/webhook/set/${name}`, { webhook: this.webhookConfig(options.webhookUrl) });
    }
  }

  private toConnectResult(data: Json | null): ConnectResult {
    const instance = (data?.instance ?? null) as Json | null;
    if (instance && asState(instance.state) === "open") {
      return { state: "open", qrCode: null, pairingCode: null, attempt: 0 };
    }
    const qrCode = typeof data?.base64 === "string" && data.base64 ? data.base64 : null;
    const pairingCode = typeof data?.pairingCode === "string" && data.pairingCode ? data.pairingCode : null;
    return {
      state: "connecting",
      qrCode,
      pairingCode,
      attempt: typeof data?.count === "number" ? data.count : 0,
    };
  }

  async connect(instanceName: string): Promise<ConnectResult> {
    const { data } = await this.request<Json>("GET", `/instance/connect/${encodeURIComponent(instanceName)}`);
    return this.toConnectResult(data);
  }

  async requestPairingCode(instanceName: string, phoneDigits: string): Promise<ConnectResult> {
    const name = encodeURIComponent(instanceName);
    // O código de pareamento só é gerado ao iniciar uma conexão nova; se já houver uma tentativa por QR
    // Code em andamento, ela é encerrada antes.
    const info = await this.getInfo(instanceName);
    if (info.state === "open") return { state: "open", qrCode: null, pairingCode: null, attempt: 0 };
    if (info.state === "connecting") {
      await this.request("DELETE", `/instance/logout/${name}`, undefined, { allowStatus: [400, 404] });
      await delay(1_000);
    }
    let result = this.toConnectResult(
      (await this.request<Json>("GET", `/instance/connect/${name}?number=${encodeURIComponent(phoneDigits)}`)).data,
    );
    if (!result.pairingCode && result.state !== "open") {
      await delay(2_000);
      result = this.toConnectResult((await this.request<Json>("GET", `/instance/connect/${name}`)).data);
    }
    return result;
  }

  async getInfo(instanceName: string): Promise<InstanceInfo> {
    const name = encodeURIComponent(instanceName);
    const stateResponse = await this.request<Json>("GET", `/instance/connectionState/${name}`, undefined, {
      allowStatus: [404],
    });
    const state = asState((stateResponse.data?.instance as Json | undefined)?.state);
    if (state !== "open") {
      return { state, phoneNumber: null, profileName: null, profilePictureUrl: null };
    }
    const { data } = await this.request<Json[]>("GET", `/instance/fetchInstances?instanceName=${name}`, undefined, {
      allowStatus: [404],
    });
    const record = Array.isArray(data) ? (data[0] as Json | undefined) : undefined;
    return {
      state,
      phoneNumber: digitsFromJid(record?.ownerJid),
      profileName: typeof record?.profileName === "string" ? record.profileName : null,
      profilePictureUrl: typeof record?.profilePicUrl === "string" ? record.profilePicUrl : null,
    };
  }

  async logout(instanceName: string): Promise<void> {
    await this.request("DELETE", `/instance/logout/${encodeURIComponent(instanceName)}`, undefined, {
      allowStatus: [400, 404],
    });
  }

  async sendText(instanceName: string, toDigits: string, text: string): Promise<{ id: string | null }> {
    const { data } = await this.request<Json>("POST", `/message/sendText/${encodeURIComponent(instanceName)}`, {
      number: toDigits,
      text,
    });
    const key = (data?.key ?? null) as Json | null;
    return { id: typeof key?.id === "string" ? key.id : null };
  }
}

/** Evento recebido no webhook da Evolution (campos usados pelo sistema). */
export interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: Json;
  date_time?: string;
}

export function parseEvolutionWebhook(body: unknown): EvolutionWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Json;
  if (typeof value.event !== "string" || typeof value.instance !== "string") return null;
  return {
    event: value.event,
    instance: value.instance,
    data: (value.data && typeof value.data === "object" ? value.data : {}) as Json,
    ...(typeof value.date_time === "string" ? { date_time: value.date_time } : {}),
  };
}

/** Extrai o estado de conexão de um evento `connection.update`. */
export function connectionFromEvent(event: EvolutionWebhookEvent): InstanceInfo | null {
  if (event.event !== "connection.update") return null;
  const state = asState(event.data.state);
  return {
    state,
    phoneNumber: state === "open" ? digitsFromJid(event.data.wuid) : null,
    profileName: typeof event.data.profileName === "string" ? event.data.profileName : null,
    profilePictureUrl: typeof event.data.profilePictureUrl === "string" ? event.data.profilePictureUrl : null,
  };
}
