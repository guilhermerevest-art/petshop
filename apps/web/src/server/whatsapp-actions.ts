"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeBrPhone } from "@petshop/core";
import { fail, ok, shopForAction, type ActionResult } from "@/lib/shop";
import { cancelConnection, disconnect, sendShopMessage, startConnection, type WhatsAppView } from "@/lib/whatsapp";

const connectSchema = z.object({
  method: z.enum(["qr", "code"]),
  phone: z.string().optional(),
  terms: z.literal("on", { error: "Confirme que leu as orientações para continuar." }),
});

export async function connectWhatsAppAction(
  _: ActionResult<WhatsAppView> | null,
  formData: FormData,
): Promise<ActionResult<WhatsAppView>> {
  const ctx = await shopForAction("whatsapp.manage");
  if ("error" in ctx) return fail(ctx.error);
  const parsed = connectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Confira os campos.", { terms: parsed.error.issues[0]?.message ?? "" });
  let phone: string | null = null;
  if (parsed.data.method === "code") {
    phone = normalizeBrPhone(parsed.data.phone ?? "");
    if (!phone) return fail("Digite o número do WhatsApp do pet shop com DDD.", { phone: "Número inválido." });
  }
  try {
    const view = await startConnection(ctx, parsed.data.method, phone);
    return ok(undefined, view);
  } catch (error) {
    console.error("connectWhatsApp", error);
    return fail("Não foi possível falar com o servidor do WhatsApp agora. Tente de novo em instantes.");
  }
}

export async function cancelWhatsAppAction(): Promise<void> {
  const ctx = await shopForAction("whatsapp.manage", { write: false });
  if ("error" in ctx) return;
  await cancelConnection(ctx).catch((error) => console.error("cancelConnection", error));
  revalidatePath("/app", "layout");
}

export async function disconnectWhatsAppAction(_: ActionResult | null): Promise<ActionResult> {
  const ctx = await shopForAction("whatsapp.manage", { write: false });
  if ("error" in ctx) return fail(ctx.error);
  try {
    await disconnect(ctx);
  } catch (error) {
    console.error("disconnect", error);
    return fail("Não foi possível desconectar agora. Tente de novo.");
  }
  revalidatePath("/app", "layout");
  return ok("WhatsApp desconectado");
}

export async function sendTestMessageAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await shopForAction("whatsapp.manage");
  if ("error" in ctx) return fail(ctx.error);
  const to = String(formData.get("phone") ?? "");
  if (!normalizeBrPhone(to)) return fail("Digite um celular com DDD.", { phone: "Número inválido." });
  const result = await sendShopMessage(
    ctx,
    to,
    `Olá! Esta é uma mensagem de teste do ${ctx.organization.name}. Se chegou, o WhatsApp está pronto para avisar seus clientes. 🐾`,
    "teste",
  );
  return result.ok ? ok("Mensagem de teste enviada") : fail(result.error ?? "Não foi possível enviar.");
}
