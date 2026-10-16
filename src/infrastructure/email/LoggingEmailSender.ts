import type { EmailMessage, IEmailSender } from "@/src/domain/repositories/IEmailSender";

/**
 * Logs the email server-side instead of delivering it — the stand-in when no SMTP
 * host is configured, so local dev and a fresh deployment work without mail
 * credentials. Same spirit as `LoggingNotificationChannel`: the container binds it
 * behind {@link IEmailSender}, so wiring a real transport touches only the
 * composition root. Best-effort by construction — logging never throws.
 */
export class LoggingEmailSender implements IEmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.info(`[email:log] to ${message.to} — ${message.subject}\n${message.text}`);
  }
}
