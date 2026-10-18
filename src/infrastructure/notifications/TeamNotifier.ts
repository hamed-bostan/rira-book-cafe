import type { IEmailSender } from "@/src/domain/repositories/IEmailSender";
import type { ITeamNotifier, TeamRecipient } from "@/src/domain/repositories/ITeamNotifier";

import { normalizePhone, sendPatternSms, type SmsIrClientConfig } from "../sms/smsIrClient";

/** The team events that can be delivered by SMS, each needing its own approved template. */
export type TeamSmsTemplates = {
  adminGranted?: number;
  ownershipReceived?: number;
  ownershipLost?: number;
};

export type TeamSmsConfig = SmsIrClientConfig & {
  /** Approved SMS.ir pattern-template id per event. An event with no id skips SMS. */
  templates: TeamSmsTemplates;
};

/** One rendered notice: an email body plus the named values a template channel needs. */
type TeamMessage = {
  subject: string;
  text: string;
  template: keyof TeamSmsTemplates;
  params: Record<string, string>;
};

/**
 * Announces team changes — an admin grant, and either side of an ownership move —
 * over email and SMS.
 *
 * Deliberately *not* wired through `INotificationChannel`: that port carries
 * `NotificationMessage`, which is order-shaped (it requires an `orderId` and a
 * `NotificationKind` from the order lifecycle). Widening those types so an
 * account-level event could travel through them would make every order channel
 * handle a message with no order — a worse trade than this small dedicated
 * notifier.
 *
 * Both channels are best-effort and independent: a missing email, an unconfigured
 * SMS template, or a dead mail server each skip that channel without affecting the
 * other, and never throw (see {@link ITeamNotifier}).
 */
export class TeamNotifier implements ITeamNotifier {
  constructor(
    private readonly email: IEmailSender,
    private readonly sms?: TeamSmsConfig,
  ) {}

  async adminGranted(recipient: TeamRecipient, signInUrl: string): Promise<void> {
    await this.deliver(recipient, {
      subject: "You've been given admin access to Rira Book Cafe",
      // The copy states the phone explicitly because that, not the email, is what
      // they sign in with — the single most confusing thing about being invited by
      // mail to a phone-identified account.
      text: [
        `Hi ${recipient.name},`,
        "",
        "You've been given admin access to the Rira Book Cafe dashboard.",
        "",
        `Sign in at ${signInUrl} using your phone number (${recipient.phone}).`,
        "You'll receive a one-time code by SMS to confirm it's you.",
        "",
        "If you weren't expecting this, you can ignore this email — and let the sender know.",
      ].join("\n"),
      template: "adminGranted",
      params: { NAME: recipient.name, URL: signInUrl },
    });
  }

  async ownershipReceived(recipient: TeamRecipient, dashboardUrl: string): Promise<void> {
    await this.deliver(recipient, {
      subject: "You now own Rira Book Cafe",
      text: [
        `Hi ${recipient.name},`,
        "",
        "You're now the owner of Rira Book Cafe.",
        "",
        "As well as running the cafe, you can add and remove admins, and hand",
        `ownership on to someone else. Manage the team at ${dashboardUrl}.`,
        "",
        "If you weren't expecting this, contact whoever transferred it to you.",
      ].join("\n"),
      template: "ownershipReceived",
      params: { NAME: recipient.name, URL: dashboardUrl },
    });
  }

  async ownershipLost(recipient: TeamRecipient, newOwnerName: string, dashboardUrl: string): Promise<void> {
    await this.deliver(recipient, {
      subject: "You're no longer the owner of Rira Book Cafe",
      // Names the new owner and says plainly what to do if it's unexpected. This
      // notice exists precisely for the case where ownership was *taken* rather
      // than given, so it can't read as a routine confirmation.
      text: [
        `Hi ${recipient.name},`,
        "",
        `${newOwnerName} is now the owner of Rira Book Cafe.`,
        "",
        "You're still an admin: the catalog, orders and customers are unchanged.",
        "You can no longer add or remove people, or transfer ownership.",
        "",
        `The dashboard is still at ${dashboardUrl}.`,
        "",
        "If you didn't agree to this, contact the new owner — and if you can reach",
        "the server configuration, you can take ownership back.",
      ].join("\n"),
      template: "ownershipLost",
      params: { NAME: recipient.name, OWNER: newOwnerName, URL: dashboardUrl },
    });
  }

  /** Fan one message out to both channels, each skipping itself when unconfigured. */
  private async deliver(recipient: TeamRecipient, message: TeamMessage): Promise<void> {
    await Promise.all([this.sendEmail(recipient, message), this.sendSms(recipient, message)]);
  }

  private async sendEmail(recipient: TeamRecipient, message: TeamMessage): Promise<void> {
    if (!recipient.email) return; // no address on file — nothing to send

    await this.email.send({
      to: recipient.email,
      subject: message.subject,
      text: message.text,
    });
  }

  private async sendSms(recipient: TeamRecipient, message: TeamMessage): Promise<void> {
    const templateId = this.sms?.templates[message.template];
    if (!this.sms || templateId === undefined) return; // no approved template for this event

    const params = Object.entries(message.params).map(([name, value]) => ({ name, value }));
    await sendPatternSms(this.sms, normalizePhone(recipient.phone), templateId, params);
  }
}
