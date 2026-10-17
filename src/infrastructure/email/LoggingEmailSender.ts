import type { EmailMessage, IEmailSender } from "@/src/domain/repositories/IEmailSender";
import type { ILogger } from "@/src/domain/repositories/ILogger";

/**
 * Logs the email server-side instead of delivering it — the stand-in when no SMTP
 * host is configured, so local dev and a fresh deployment work without mail
 * credentials. Same spirit as `LoggingNotificationChannel`: the container binds it
 * behind {@link IEmailSender}, so wiring a real transport touches only the
 * composition root. Best-effort by construction — logging never throws.
 */
export class LoggingEmailSender implements IEmailSender {
  constructor(private readonly logger: ILogger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.info("Email logged instead of sent (no SMTP host)", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
