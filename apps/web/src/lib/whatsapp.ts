import "server-only";
import { eq } from "drizzle-orm";
import { normalizeBrPhone, toWhatsAppNumber } from "@petshop/core";
import { messages, whatsappInstances, withSystem, type WhatsAppStatus } from "@petshop/db";
import type { ConnectResult, InstanceInfo } from "@petshop/integrations";
import { audit } from "./audit";
import { db } from "./db";
import { appUrl, env } from "./env";
import { completeStep } from "./onboarding";
import { messaging } from "./providers";
import { inShop, type ShopContext } from "./shop";

export function instanceNameFor(organizationId: string): string {
  return `ps_${organizationId}`;
}

function webhookUrl(): string | null {
  const token = env().EVOLUTION_WEBHOOK_TOKEN;
  return token ? appUrl(`/api/webhooks/evolution?token=${encodeURIComponent(token)}`) : null;
}

export type WhatsAppRow = typeof whatsappInstances.$inferSelect;

export interface WhatsAppView {
  status: WhatsAppStatus;
  phoneNumber: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
  connectedAt: string | null;
  termsAccepted: boolean;
  qrCode: string | null;
  pairingCode: string | null;
}

export function toView(
  row: WhatsAppRow | null | undefined,
  extra: Partial<WhatsAppView> = {},
): WhatsAppView {
  return {
    status: row?.status ?? "disconnected",
    phoneNumber: row?.phoneNumber ?? null,
    profileName: row?.profileName ?? null,
    profilePictureUrl: row?.profilePictureUrl ?? null,
    connectedAt: row?.connectedAt?.toISOString() ?? null,
    termsAccepted: Boolean(row?.termsAcceptedAt),
    qrCode: null,
    pairingCode: null,
    ...extra,
  };
}

export async function getWhatsApp(
  ctx: Pick<ShopContext, "organization">,
): Promise<WhatsAppRow | null> {
  return (
    (await inShop(ctx, (tx) =>
      tx.query.whatsappInstances.findFirst({
        where: eq(whatsappInstances.organizationId, ctx.organization.id),
      }),
    )) ?? null
  );
}

/** Grava o estado informado pela Evolution e registra conexões e quedas na auditoria. */
async function applyInfo(organizationId: string, info: InstanceInfo): Promise<WhatsAppRow | null> {
  return withSystem(db(), async (tx) => {
    const row = await tx.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.organizationId, organizationId),
    });
    if (!row) return null;
    const now = new Date();
    if (info.state === "open") {
      const [updated] = await tx
        .update(whatsappInstances)
        .set({
          status: "connected",
          phoneNumber: info.phoneNumber ? `+${info.phoneNumber}` : row.phoneNumber,
          profileName: info.profileName ?? row.profileName,
          profilePictureUrl: info.profilePictureUrl ?? row.profilePictureUrl,
          connectedAt: row.status === "connected" ? row.connectedAt : now,
          lastEventAt: now,
        })
        .where(eq(whatsappInstances.organizationId, organizationId))
        .returning();
      if (row.status !== "connected") {
        await completeStep(tx, organizationId, "whatsapp");
        await audit(tx, { organizationId, userId: null }, "whatsapp.conectado", {
          data: { numero: info.phoneNumber },
        });
      }
      return updated ?? row;
    }
    if (row.status === "connected" && info.state === "close") {
      const [updated] = await tx
        .update(whatsappInstances)
        .set({ status: "disconnected", disconnectedAt: now, lastEventAt: now })
        .where(eq(whatsappInstances.organizationId, organizationId))
        .returning();
      await audit(tx, { organizationId, userId: null }, "whatsapp.desconectado");
      return updated ?? row;
    }
    return row;
  });
}

/** Atualiza o estado a partir de um evento do webhook da Evolution. */
export async function applyWebhookConnection(
  instanceName: string,
  info: InstanceInfo,
): Promise<void> {
  const row = await withSystem(db(), (tx) =>
    tx.query.whatsappInstances.findFirst({
      where: eq(whatsappInstances.instanceName, instanceName),
    }),
  );
  if (row) await applyInfo(row.organizationId, info);
}

/** Inicia a conexão por QR Code ou por código de pareamento. */
export async function startConnection(
  ctx: ShopContext,
  method: "qr" | "code",
  phone: string | null,
): Promise<WhatsAppView> {
  const instanceName = instanceNameFor(ctx.organization.id);
  await inShop(ctx, (tx) =>
    tx
      .insert(whatsappInstances)
      .values({
        organizationId: ctx.organization.id,
        instanceName,
        status: "connecting",
        termsAcceptedAt: new Date(),
        termsAcceptedBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: whatsappInstances.organizationId,
        set: { status: "connecting", termsAcceptedAt: new Date(), termsAcceptedBy: ctx.user.id },
      }),
  );

  const provider = messaging();
  await provider.ensureInstance(instanceName, { webhookUrl: webhookUrl() });
  const result: ConnectResult =
    method === "code" && phone
      ? await provider.requestPairingCode(instanceName, toWhatsAppNumber(phone))
      : await provider.connect(instanceName);

  if (result.state === "open") return refreshStatus(ctx, { refreshQr: false });
  return toView(await getWhatsApp(ctx), {
    status: "connecting",
    qrCode: result.qrCode,
    pairingCode: result.pairingCode,
  });
}

/** Consulta o estado atual (usado pela tela enquanto espera a leitura do QR Code). */
export async function refreshStatus(
  ctx: ShopContext,
  { refreshQr }: { refreshQr: boolean },
): Promise<WhatsAppView> {
  const row = await getWhatsApp(ctx);
  if (!row) return toView(null);
  const provider = messaging();
  const info = await provider.getInfo(row.instanceName);
  const updated = await applyInfo(ctx.organization.id, info);
  if (info.state === "open" || row.status !== "connecting" || !refreshQr)
    return toView(updated ?? row);
  const result = await provider.connect(row.instanceName);
  if (result.state === "open") return refreshStatus(ctx, { refreshQr: false });
  return toView(updated ?? row, {
    status: "connecting",
    qrCode: result.qrCode,
    pairingCode: result.pairingCode,
  });
}

export async function disconnect(ctx: ShopContext): Promise<void> {
  const row = await getWhatsApp(ctx);
  if (!row) return;
  await messaging().logout(row.instanceName);
  await inShop(ctx, async (tx) => {
    await tx
      .update(whatsappInstances)
      .set({ status: "disconnected", disconnectedAt: new Date(), lastEventAt: new Date() })
      .where(eq(whatsappInstances.organizationId, ctx.organization.id));
    await audit(tx, ctx, "whatsapp.desconectado_pelo_usuario");
  });
}

/** Cancela uma tentativa de conexão que não foi concluída. */
export async function cancelConnection(ctx: ShopContext): Promise<void> {
  const row = await getWhatsApp(ctx);
  if (!row || row.status !== "connecting") return;
  await messaging().logout(row.instanceName);
  await inShop(ctx, (tx) =>
    tx
      .update(whatsappInstances)
      .set({ status: "disconnected" })
      .where(eq(whatsappInstances.organizationId, ctx.organization.id)),
  );
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Envia uma mensagem pelo WhatsApp do pet shop e registra no histórico. */
export async function sendShopMessage(
  ctx: Pick<ShopContext, "organization"> & { user?: { id: string } },
  to: string,
  body: string,
  kind: string,
): Promise<SendResult> {
  const phone = normalizeBrPhone(to);
  if (!phone) return { ok: false, error: "Celular inválido." };
  const row = await getWhatsApp(ctx);
  if (!row || row.status !== "connected")
    return { ok: false, error: "O WhatsApp do pet shop não está conectado." };

  let providerMessageId: string | null = null;
  let error: string | null = null;
  try {
    providerMessageId = (
      await messaging().sendText(row.instanceName, toWhatsAppNumber(phone), body)
    ).id;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  await inShop(ctx, (tx) =>
    tx.insert(messages).values({
      organizationId: ctx.organization.id,
      direction: "out",
      phone,
      kind,
      body,
      status: error ? "failed" : "sent",
      providerMessageId,
      error,
      createdBy: ctx.user?.id ?? null,
    }),
  );
  return error
    ? {
        ok: false,
        error: "Não foi possível enviar a mensagem. Confira se o WhatsApp está conectado.",
      }
    : { ok: true };
}
