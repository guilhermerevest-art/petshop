import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

/**
 * Aplica as migrações com o papel dono das tabelas e, em seguida:
 * - garante que o papel da aplicação exista e tenha acesso às tabelas;
 * - força o RLS também para o dono (FORCE ROW LEVEL SECURITY), para que nenhum caminho o ignore.
 * O papel da aplicação nasce sem login; a senha é definida na infraestrutura (ver docs/infra.md).
 */
export async function runMigrations(ownerUrl: string, appRole = "petshop_app"): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/.test(appRole)) throw new Error(`Nome de papel inválido: ${appRole}`);
  const client = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${appRole}') THEN
          CREATE ROLE ${appRole} NOLOGIN;
        END IF;
      END $$;
    `);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    await client.unsafe(`
      GRANT USAGE ON SCHEMA public TO ${appRole};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appRole};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRole};
    `);
    const tables = await client<{ name: string }[]>`
      SELECT c.relname AS name
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity AND NOT c.relforcerowsecurity
    `;
    for (const { name } of tables) {
      await client.unsafe(`ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`);
    }
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    console.error("Defina DATABASE_URL_OWNER (conexão direta com o papel dono das tabelas).");
    process.exit(1);
  }
  runMigrations(url, process.env.DB_APP_ROLE ?? "petshop_app")
    .then(() => console.log("Migrações aplicadas."))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
