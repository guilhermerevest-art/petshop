import { and, eq, inArray, lt } from "drizzle-orm";
import {
  auditLogs,
  member,
  organization,
  user,
  whatsappInstances,
  withSystem,
  type Database,
} from "@petshop/db";
import type { Mailer, MessagingProvider } from "@petshop/integrations";

/** Tentativas de conexão abandonadas (QR Code nunca lido) voltam para "desconectado" depois disto. */
const ABANDONED_AFTER_MS = 15 * 60 * 1000;

export interface MonitorResult {
  checked: number;
  disconnected: string[];
  abandoned: number;
  errors: number;
}

/**
 * Confere a conexão de cada WhatsApp que o sistema acha que está conectado. Se caiu, marca como
 * desconectado, registra na auditoria e avisa os donos do pet shop por e-mail.
 */
export async function monitorWhatsApp(
  db: Database,
  messaging: MessagingProvider,
  mailer: Mailer,
  appUrl: string,
  now = new Date(),
): Promise<MonitorResult> {
  const result: MonitorResult = { checked: 0, disconnected: [], abandoned: 0, errors: 0 };

  const abandoned = await withSystem(db, (tx) =>
    tx
      .update(whatsappInstances)
      .set({ status: "disconnected" })
      .where(
        and(
          eq(whatsappInstances.status, "connecting"),
          lt(whatsappInstances.updatedAt, new Date(now.getTime() - ABANDONED_AFTER_MS)),
        ),
      )
      .returning({ id: whatsappInstances.organizationId }),
  );
  result.abandoned = abandoned.length;

  const connected = await withSystem(db, (tx) =>
    tx
      .select({
        organizationId: whatsappInstances.organizationId,
        instanceName: whatsappInstances.instanceName,
        shopName: organization.name,
      })
      .from(whatsappInstances)
      .innerJoin(organization, eq(organization.id, whatsappInstances.organizationId))
      .where(eq(whatsappInstances.status, "connected")),
  );

  for (const instance of connected) {
    result.checked++;
    let state: string;
    try {
      state = (await messaging.getInfo(instance.instanceName)).state;
    } catch (error) {
      result.errors++;
      console.error(`[monitor] falha ao consultar ${instance.instanceName}`, error);
      continue;
    }
    if (state === "open") continue;

    await withSystem(db, async (tx) => {
      await tx
        .update(whatsappInstances)
        .set({ status: "disconnected", disconnectedAt: now, lastEventAt: now })
        .where(eq(whatsappInstances.organizationId, instance.organizationId));
      await tx.insert(auditLogs).values({
        organizationId: instance.organizationId,
        action: "whatsapp.desconectado",
        data: { detectadoPor: "monitor" },
      });
    });
    result.disconnected.push(instance.organizationId);

    const owners = await db
      .select({ email: user.email, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(member.organizationId, instance.organizationId),
          inArray(member.role, ["owner", "manager"]),
        ),
      );
    for (const owner of owners) {
      await mailer
        .send({
          to: owner.email,
          subject: `O WhatsApp do ${instance.shopName} desconectou`,
          text: `Olá, ${owner.name}.\n\nO WhatsApp do ${instance.shopName} foi desconectado do sistema. Enquanto isso, confirmações e lembretes não chegam aos clientes; as mensagens ficam guardadas.\n\nPara conectar de novo, abra:\n${new URL("/app/configuracoes/whatsapp", appUrl).toString()}`,
        })
        .catch((error) => console.error("[monitor] falha ao enviar e-mail", error));
    }
  }
  return result;
}
