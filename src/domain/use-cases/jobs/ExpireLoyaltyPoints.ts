import { SYSTEM_ACTOR } from "../../entities/ActivityEntry";
import { addMonths, pointsExpireAt, POINTS_EXPIRY_WARNING_DAYS } from "../../entities/Loyalty";
import { pointsExpiredNotification, pointsExpiringNotification } from "../notifications/guestNotifications";

import { forEachSettled } from "./forEachSettled";

import type { ILoyaltyRepository } from "../../repositories/ILoyaltyRepository";
import type { ICustomerNotifier } from "../../repositories/INotificationRepository";

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * How many guests one run reads. Oldest activity first, so the ones due go first;
 * a cafe never has near this many lapsing at once, and the next run carries on.
 */
const BATCH = 2000;
/** Slack on the read's cut-off: month arithmetic isn't exactly reversible (31 Jan + 1 month = 28 Feb). */
const CUTOFF_SLACK_DAYS = 3;

/**
 * Lapse loyalty points left unused — only when the owner set an expiry (the club's
 * `pointsExpiryMonths`; 0, the default, means points never expire) and the club is
 * on. A guest's whole balance lapses once they've gone that many months without
 * earning or spending (`pointsExpireAt`): it comes off as an `expire` entry on their
 * points ledger, logged under the system actor, and they're told in their messages.
 * A guest whose points lapse within `POINTS_EXPIRY_WARNING_DAYS` is told beforehand,
 * once. Resolves to how many guests' points lapsed.
 *
 * Safe to repeat: the repository takes the balance only if nothing moved since it
 * was read (a visit in between keeps the points), and once per stretch of inactivity;
 * the messages are deduplicated the same way.
 */
export class ExpireLoyaltyPoints {
  constructor(
    private readonly loyaltyRepo: Pick<ILoyaltyRepository, "getSettings" | "listLapsing" | "expire">,
    private readonly notifier: ICustomerNotifier,
  ) {}

  async execute(now: Date): Promise<number> {
    const settings = await this.loyaltyRepo.getSettings();
    if (!settings.enabled || settings.pointsExpiryMonths <= 0) return 0;

    const horizon = new Date(now.getTime() + POINTS_EXPIRY_WARNING_DAYS * DAY_MS);
    const activeBefore = new Date(
      addMonths(horizon, -settings.pointsExpiryMonths).getTime() + CUTOFF_SLACK_DAYS * DAY_MS,
    );
    const candidates = await this.loyaltyRepo.listLapsing(activeBefore, BATCH);

    let expired = 0;
    await forEachSettled(candidates, async (lapse) => {
      const expiresAt = pointsExpireAt(lapse.lastActivityAt, settings);
      if (!expiresAt || expiresAt > horizon) return;
      if (expiresAt > now) {
        await this.notifier.notify(pointsExpiringNotification(lapse, expiresAt));
        return;
      }
      const points = await this.loyaltyRepo.expire(
        { ...lapse, note: `No activity for ${settings.pointsExpiryMonths} months` },
        (entry) => ({
          actorId: SYSTEM_ACTOR.id,
          actorName: SYSTEM_ACTOR.name,
          action: "loyalty.pointsExpired",
          entityType: "loyalty",
          entityId: lapse.userId,
          entityLabel: lapse.userId,
          changes: [{ field: "points", before: String(lapse.balance), after: String(lapse.balance + entry.delta) }],
        }),
      );
      if (points <= 0) return;
      expired += 1;
      await this.notifier.notify(pointsExpiredNotification(lapse, points));
    });
    return expired;
  }
}
