import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { connectionFromEvent, parseEvolutionWebhook } from "@petshop/integrations";
import { messages, withSystem } from "@petshop/db";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { applyWebhookConnection } from "@/lib/whatsapp";

function validToken(received: string | null): boolean {
  const expected = env().EVOLUTION_WEBHOOK_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STATUS_MAP: Record<string, "delivered" | "read" | "failed" | "sent"> = {
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
};

/** Eventos da Evolution API: conexão do número e status de entrega das mensagens. */
export async function POST(request: Request) {
  if (!validToken(new URL(request.url).searchParams.get("token"))) {
    return Response.json({ error: "Token inválido" }, { status: 401 });
  }
  const event = parseEvolutionWebhook(await request.json().catch(() => null));
  if (!event) return Response.json({ error: "Evento inválido" }, { status: 400 });

  try {
    const connection = connectionFromEvent(event);
    if (connection) {
      await applyWebhookConnection(event.instance, connection);
    } else if (event.event === "messages.update") {
      const id = typeof event.data.keyId === "string" ? event.data.keyId : null;
      const status =
        typeof event.data.status === "string" ? STATUS_MAP[event.data.status] : undefined;
      if (id && status) {
        await withSystem(db(), (tx) =>
          tx.update(messages).set({ status }).where(eq(messages.providerMessageId, id)),
        );
      }
    }
  } catch (error) {
    console.error("evolution webhook", error);
    return Response.json({ error: "Falha ao processar" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
