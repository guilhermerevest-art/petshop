import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export interface CreateDbOptions {
  /** Conexões por instância. Em serverless, mantenha baixo: o PgBouncer faz o pool de verdade. */
  max?: number;
}

/**
 * Cliente do banco para a aplicação. Use sempre a URL do papel da aplicação (sem privilégio de dono),
 * para que as políticas de RLS se apliquem.
 * `prepare: false` é obrigatório atrás do PgBouncer em modo transaction.
 */
export function createDb(url: string, options: CreateDbOptions = {}) {
  const client = postgres(url, {
    prepare: false,
    max: options.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export async function closeDb(db: Database): Promise<void> {
  await db.$client.end({ timeout: 5 });
}
