import "server-only";
import { createDb, type Database } from "@petshop/db";
import { env } from "./env";

const globalForDb = globalThis as unknown as { __petshopDb?: Database };

/** Conexão da aplicação (papel sem privilégio de dono: o RLS vale para todas as consultas). */
export function db(): Database {
  if (!globalForDb.__petshopDb) {
    globalForDb.__petshopDb = createDb(env().DATABASE_URL, {
      max: env().NODE_ENV === "production" ? 3 : 10,
    });
  }
  return globalForDb.__petshopDb;
}
