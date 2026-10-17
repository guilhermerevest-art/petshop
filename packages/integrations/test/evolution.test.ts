import { describe, expect, it } from "vitest";
import { connectionFromEvent, EvolutionProvider, parseEvolutionWebhook } from "../src/evolution";
import { formatPairingCode } from "../src/messaging";

type Call = { method: string; url: string; body: unknown; apikey: string | null };

function fakeFetch(routes: Record<string, { status?: number; body: unknown } | ((call: Call) => { status?: number; body: unknown })>) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const call: Call = {
      method,
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      apikey: headers.get("apikey"),
    };
    calls.push(call);
    const key = `${method} ${url.replace("https://evo.test", "")}`;
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ message: "not mocked" }), { status: 500 });
    const result = typeof route === "function" ? route(call) : route;
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200 });
  }) as typeof fetch;
  return { calls, impl };
}

describe("Evolution API", () => {
  it("cria a instância com webhook quando ela não existe", async () => {
    const { calls, impl } = fakeFetch({
      "GET /instance/fetchInstances?instanceName=ps_1": { status: 404, body: { message: "not found" } },
      "POST /instance/create": { status: 201, body: { instance: { instanceName: "ps_1" } } },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test/", apiKey: "global-key", fetch: impl });
    await evo.ensureInstance("ps_1", { webhookUrl: "https://app.test/api/webhooks/evolution?token=x" });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.apikey).toBe("global-key");
    expect(calls[1]!.body).toMatchObject({
      instanceName: "ps_1",
      integration: "WHATSAPP-BAILEYS",
      webhook: { enabled: true, url: "https://app.test/api/webhooks/evolution?token=x" },
    });
    expect((calls[1]!.body as { webhook: { events: string[] } }).webhook.events).toContain("CONNECTION_UPDATE");
  });

  it("só atualiza o webhook quando a instância já existe", async () => {
    const { calls, impl } = fakeFetch({
      "GET /instance/fetchInstances?instanceName=ps_1": { body: [{ name: "ps_1" }] },
      "POST /webhook/set/ps_1": { body: {} },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test", apiKey: "k", fetch: impl });
    await evo.ensureInstance("ps_1", { webhookUrl: "https://app.test/hook" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://evo.test/instance/fetchInstances?instanceName=ps_1",
      "POST https://evo.test/webhook/set/ps_1",
    ]);
    expect(calls[1]!.body).toMatchObject({ webhook: { url: "https://app.test/hook", enabled: true } });
  });

  it("devolve o QR Code enquanto aguarda a leitura", async () => {
    const { impl } = fakeFetch({
      "GET /instance/connect/ps_1": { body: { pairingCode: null, code: "2@abc", base64: "data:image/png;base64,AAA", count: 2 } },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test", apiKey: "k", fetch: impl });
    expect(await evo.connect("ps_1")).toEqual({
      state: "connecting",
      qrCode: "data:image/png;base64,AAA",
      pairingCode: null,
      attempt: 2,
    });
  });

  it("reconhece quando já está conectado", async () => {
    const { impl } = fakeFetch({
      "GET /instance/connect/ps_1": { body: { instance: { instanceName: "ps_1", state: "open" } } },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test", apiKey: "k", fetch: impl });
    expect((await evo.connect("ps_1")).state).toBe("open");
  });

  it("lê número e perfil da instância conectada", async () => {
    const { impl } = fakeFetch({
      "GET /instance/connectionState/ps_1": { body: { instance: { instanceName: "ps_1", state: "open" } } },
      "GET /instance/fetchInstances?instanceName=ps_1": {
        body: [{ ownerJid: "5519987654321@s.whatsapp.net", profileName: "Pet Shop Bom Banho", profilePicUrl: "https://pic" }],
      },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test", apiKey: "k", fetch: impl });
    expect(await evo.getInfo("ps_1")).toEqual({
      state: "open",
      phoneNumber: "5519987654321",
      profileName: "Pet Shop Bom Banho",
      profilePictureUrl: "https://pic",
    });
  });

  it("encerra a tentativa por QR Code antes de pedir o código de pareamento", async () => {
    const { calls, impl } = fakeFetch({
      "GET /instance/connectionState/ps_1": { body: { instance: { state: "connecting" } } },
      "DELETE /instance/logout/ps_1": { body: { status: "SUCCESS" } },
      "GET /instance/connect/ps_1?number=5519987654321": { body: { pairingCode: "ABCD1234", count: 1 } },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test", apiKey: "k", fetch: impl });
    const result = await evo.requestPairingCode("ps_1", "5519987654321");
    expect(result.pairingCode).toBe("ABCD1234");
    expect(calls.map((c) => c.method)).toEqual(["GET", "DELETE", "GET"]);
    expect(formatPairingCode(result.pairingCode)).toBe("ABCD-1234");
  });

  it("envia texto e devolve o id da mensagem", async () => {
    const { calls, impl } = fakeFetch({
      "POST /message/sendText/ps_1": { status: 201, body: { key: { id: "MSG1", fromMe: true } } },
    });
    const evo = new EvolutionProvider({ baseUrl: "https://evo.test", apiKey: "k", fetch: impl });
    expect(await evo.sendText("ps_1", "5519987654321", "Olá")).toEqual({ id: "MSG1" });
    expect(calls[0]!.body).toEqual({ number: "5519987654321", text: "Olá" });
  });

  it("interpreta eventos de conexão do webhook", () => {
    const event = parseEvolutionWebhook({
      event: "connection.update",
      instance: "ps_1",
      data: { state: "open", wuid: "5519987654321@s.whatsapp.net", profileName: "Bom Banho" },
    });
    expect(event).not.toBeNull();
    expect(connectionFromEvent(event!)).toMatchObject({ state: "open", phoneNumber: "5519987654321" });
    expect(parseEvolutionWebhook({ foo: 1 })).toBeNull();
  });
});
