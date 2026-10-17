import { sql } from "drizzle-orm";
import type { Database } from "./client";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Executa `fn` numa transação com o pet shop atual definido para o RLS.
 * Toda leitura e escrita em tabelas de negócio deve passar por aqui: sem isso o banco não devolve nenhuma linha.
 */
export async function withTenant<T>(
  db: Database,
  organizationId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  if (!organizationId) throw new Error("withTenant: organizationId obrigatório");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${organizationId}, true)`);
    return fn(tx);
  });
}

/**
 * Executa `fn` com acesso a todos os pet shops. Só para processos do sistema que não agem em nome de um
 * pet shop: webhooks, worker e painel da plataforma.
 */
export async function withSystem<T>(db: Database, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.system', 'on', true)`);
    return fn(tx);
  });
}
