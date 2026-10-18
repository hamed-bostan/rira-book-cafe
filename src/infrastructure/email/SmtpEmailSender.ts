import nodemailer, { type Transporter } from "nodemailer";

import type { EmailMessage, IEmailSender } from "@/src/domain/repositories/IEmailSender";
import type { ILogger } from "@/src/domain/repositories/ILogger";

export type SmtpConfig = {
  host: string;
  port: number;
  /** STARTTLS on 587 (`false`) vs. implicit TLS on 465 (`true`). */
  secure: boolean;
  user?: string;
  password?: string;
  /** Envelope sender, e.g. `Rira Book Cafe <no-reply@rira.example>`. */
  from: string;
};

/** How long to wait on a mail server before giving up (it must never stall a request). */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Transactional email over plain SMTP (nodemailer).
 *
 * SMTP rather than a provider HTTP API on purpose: this app is deployed on a VPS
 * in Iran, and the usual API providers (Resend, SendGrid, Postmark, Mailgun)
 * geo-block Iranian IPs outright. SMTP works against any host — an Iranian
 * provider, a self-hosted relay, or a proxy abroad — so the deployment can point
 * this at whatever it can actually reach without a code change.
 *
 * Best-effort by contract: a failure is logged and swallowed (see `IEmailSender`).
 */
export class SmtpEmailSender implements IEmailSender {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    private readonly logger: ILogger,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      connectionTimeout: REQUEST_TIMEOUT_MS,
      greetingTimeout: REQUEST_TIMEOUT_MS,
      socketTimeout: REQUEST_TIMEOUT_MS,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
    } catch (error) {
      // Never rethrow: the change that triggered this mail has already committed.
      this.logger.error("SMTP send failed", { error, to: message.to, subject: message.subject });
    }
  }
}
