import { sql } from "drizzle-orm";
import type { Database } from "./client";

export interface RoleCheck {
  role: string;
  /** Superusuário ou BYPASSRLS ignoram o isolamento entre pet shops. */
  bypassesRls: boolean;
}

/** Confere se o usuário da conexão respeita o RLS. A aplicação nunca deve usar um que o ignore. */
export async function checkDatabaseRole(db: Database): Promise<RoleCheck> {
  const rows = await db.execute<{ role: string; bypass: boolean }>(
    sql`select current_user as role, (rolsuper or rolbypassrls) as bypass from pg_roles where rolname = current_user`,
  );
  const row = rows[0];
  return { role: row?.role ?? "desconhecido", bypassesRls: Boolean(row?.bypass) };
}
