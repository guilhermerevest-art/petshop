import { createTransport, type Mail } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  readonly kind: "smtp" | "console";
  send(message: EmailMessage): Promise<void>;
}

/** Envio por SMTP: funciona com qualquer provedor (Resend, Brevo, Amazon SES, Gmail Workspace…). */
export class SmtpMailer implements Mailer {
  readonly kind = "smtp" as const;
  private readonly transport: Mail;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = createTransport(smtpUrl);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

/** Sem SMTP configurado (desenvolvimento): o e-mail aparece no log do servidor. */
export class ConsoleMailer implements Mailer {
  readonly kind = "console" as const;
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    console.info(`[e-mail] para ${message.to}: ${message.subject}\n${message.text}`);
  }
}
