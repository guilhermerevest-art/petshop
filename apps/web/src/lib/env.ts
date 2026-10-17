import "server-only";
import { z } from "zod";

const DEV_SECRET = "dev-secret-troque-em-producao-0123456789abcdef";

const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgres://petshop_app:petshop_app@localhost:5432/petshop"),
  BETTER_AUTH_SECRET: z.string().min(32).default(DEV_SECRET),

  BILLING_PROVIDER: z.enum(["stripe", "fake"]).optional(),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_ID: optional,
  BILLING_TRIAL_DAYS: z.coerce.number().int().min(0).max(90).default(14),

  MESSAGING_PROVIDER: z.enum(["evolution", "fake"]).optional(),
  EVOLUTION_API_URL: optional,
  EVOLUTION_API_KEY: optional,
  EVOLUTION_WEBHOOK_TOKEN: optional,
  /** Instância da Evolution com o número da própria plataforma (avisos aos pet shops). */
  PLATFORM_WHATSAPP_INSTANCE: optional,
  FAKE_WHATSAPP_CONNECT_MS: z.coerce.number().int().min(0).default(6000),

  SMTP_URL: optional,
  EMAIL_FROM: z.string().default("PetShop <nao-responda@localhost>"),

  /** E-mails com acesso ao painel da plataforma, separados por vírgula. */
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Lê e valida as variáveis de ambiente na primeira vez que forem usadas (não no build). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  if (parsed.NODE_ENV === "production" && parsed.BETTER_AUTH_SECRET === DEV_SECRET) {
    throw new Error("Defina BETTER_AUTH_SECRET em produção (openssl rand -base64 32).");
  }
  cached = parsed;
  return parsed;
}

export function appUrl(path = "/"): string {
  return new URL(path, env().APP_URL).toString();
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return env()
    .PLATFORM_ADMIN_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
