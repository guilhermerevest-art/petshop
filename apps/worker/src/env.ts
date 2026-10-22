function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name}`);
  return value;
}

export function loadEnv() {
  return {
    /** Conexão da aplicação (papel petshop_app): o RLS vale aqui também. */
    databaseUrl: required("DATABASE_URL"),
    /** Conexão para a fila (pg-boss cria e mantém o próprio schema). Direta, sem PgBouncer. */
    queueDatabaseUrl: process.env.QUEUE_DATABASE_URL ?? required("DATABASE_URL_OWNER"),
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    evolutionUrl: process.env.EVOLUTION_API_URL,
    evolutionKey: process.env.EVOLUTION_API_KEY,
    smtpUrl: process.env.SMTP_URL,
    emailFrom: process.env.EMAIL_FROM ?? "PetShop <nao-responda@localhost>",
    port: Number(process.env.PORT ?? 8080),
    monitorCron: process.env.WHATSAPP_MONITOR_CRON ?? "*/5 * * * *",
  };
}

export type WorkerEnv = ReturnType<typeof loadEnv>;
