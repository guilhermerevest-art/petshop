import { shopForAction } from "@/lib/shop";
import { refreshStatus } from "@/lib/whatsapp";

/** Consultado pela tela a cada poucos segundos enquanto espera a leitura do QR Code. */
export async function GET(request: Request) {
  const ctx = await shopForAction("whatsapp.manage", { write: false });
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: 403 });
  const refreshQr = new URL(request.url).searchParams.get("qr") === "1";
  try {
    const view = await refreshStatus(ctx, { refreshQr });
    return Response.json(view, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("whatsapp status", error);
    return Response.json({ error: "Servidor do WhatsApp indisponível" }, { status: 502 });
  }
}
