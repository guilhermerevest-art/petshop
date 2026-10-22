import { createServer } from "node:http";
import { PgBoss } from "pg-boss";
import { createDb } from "@petshop/db";
import {
  ConsoleMailer,
  EvolutionProvider,
  FakeMessagingProvider,
  SmtpMailer,
  type MessagingProvider,
} from "@petshop/integrations";
import { loadEnv } from "./env";
import { monitorWhatsApp } from "./monitor";
import { sendReminders } from "./reminders";

const QUEUE_MONITOR = "whatsapp-monitor";
const QUEUE_REMINDERS = "agenda-lembretes";

async function main() {
  const env = loadEnv();
  const db = createDb(env.databaseUrl, { max: 3 });
  const messaging: MessagingProvider =
    env.evolutionUrl && env.evolutionKey
      ? new EvolutionProvider({ baseUrl: env.evolutionUrl, apiKey: env.evolutionKey })
      : new FakeMessagingProvider();
  const mailer = env.smtpUrl ? new SmtpMailer(env.smtpUrl, env.emailFrom) : new ConsoleMailer();

  const boss = new PgBoss({ connectionString: env.queueDatabaseUrl, schema: "pgboss" });
  boss.on("error", (error) => console.error("[fila]", error));
  await boss.start();

  await boss.createQueue(QUEUE_MONITOR);
  await boss.schedule(QUEUE_MONITOR, env.monitorCron, null, { tz: "America/Sao_Paulo" });
  await boss.work(QUEUE_MONITOR, async () => {
    const result = await monitorWhatsApp(db, messaging, mailer, env.appUrl);
    console.info("[monitor]", JSON.stringify(result));
  });

  await boss.createQueue(QUEUE_REMINDERS);
  await boss.schedule(QUEUE_REMINDERS, env.remindersCron, null, { tz: "America/Sao_Paulo" });
  await boss.work(QUEUE_REMINDERS, async () => {
    const result = await sendReminders(db, messaging);
    if (result.sent || result.failed) console.info("[lembretes]", JSON.stringify(result));
  });

  // Saúde do processo para o Coolify.
  let healthy = true;
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: healthy }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(env.port, () => console.info(`[worker] pronto (saúde em :${env.port}/health)`));

  const shutdown = async (signal: string) => {
    console.info(`[worker] encerrando (${signal})`);
    healthy = false;
    server.close();
    await boss.stop({ graceful: true, timeout: 20_000 });
    await db.$client.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[worker] falha ao iniciar", error);
  process.exit(1);
});
