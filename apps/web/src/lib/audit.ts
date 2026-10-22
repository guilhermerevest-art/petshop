import "server-only";
import { auditLogs, type Transaction } from "@petshop/db";

/** Registra uma ação sensível na auditoria do pet shop (dentro da mesma transação da alteração). */
export async function audit(
  tx: Transaction,
  ctx:
    | { organization: { id: string }; user: { id: string } }
    | { organizationId: string | null; userId: string | null },
  action: string,
  details: { entity?: string; entityId?: string; data?: unknown } = {},
): Promise<void> {
  const organizationId = "organization" in ctx ? ctx.organization.id : ctx.organizationId;
  const actorUserId = "user" in ctx ? ctx.user.id : ctx.userId;
  await tx.insert(auditLogs).values({
    organizationId,
    actorUserId,
    action,
    entity: details.entity ?? null,
    entityId: details.entityId ?? null,
    data: (details.data ?? null) as never,
  });
}
