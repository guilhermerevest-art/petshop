import { sql, type SQL } from "drizzle-orm";
import { pgPolicy, text, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { organization } from "./auth";

/**
 * Política de isolamento entre pet shops (RLS). A linha só é visível/gravável quando a transação
 * declarou o mesmo pet shop (`app.org_id`) ou está em contexto de sistema (`app.system`).
 * Ver `withTenant` e `withSystem` em ../tenancy.ts.
 */
function tenantCondition(column: AnyPgColumn): SQL {
  return sql`(${column} = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')`;
}

export function tenantPolicy(column: AnyPgColumn) {
  const condition = tenantCondition(column);
  return pgPolicy("tenant_isolation", {
    as: "permissive",
    for: "all",
    using: condition,
    withCheck: condition,
  });
}

export const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
