/** One file attached to an outbound email — e.g. nodemailer's own attachment shape. */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

/** One outbound email. `html` is optional — `text` is always the fallback body. */
export type EmailMessage = {
  /** Recipient address. */
  to: string;
  subject: string;
  /** Plain-text body. Required: some clients (and every deliverability checker) want it. */
  text: string;
  /** Optional HTML body, shown in preference to `text` where the client supports it. */
  html?: string;
  /**
   * Optional file attachments. Unused today — the export-ready email sends a
   * signed link instead (see `NotifyExportReady`), since a link avoids mail-size
   * limits and doesn't duplicate a file that already lives in storage — but the
   * port carries it so a future caller that genuinely needs to attach a file
   * (a receipt, say) doesn't have to widen this contract to do it.
   */
  attachments?: EmailAttachment[];
};

/**
 * Sends transactional email. A port (not an implementation) so the domain stays
 * transport-agnostic: the container binds SMTP, an HTTP provider, or a logging
 * stub without any use-case knowing which — the same Dependency Inversion the
 * repositories and notifiers use.
 *
 * `send` is **best-effort**: it resolves whether or not delivery succeeded and
 * must not throw. The state change that triggered the mail has already committed,
 * so a dead mail server can't be allowed to fail the request behind it.
 * Implementations log their own failures.
 */
export type IEmailSender = {
  send(message: EmailMessage): Promise<void>;
};
