import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOYALTY_SETTINGS, type LapsingPoints, type LoyaltySettings } from "../../../entities/Loyalty";
import { GetGuestLoyaltyOverview } from "../../promotions/PromotionCommands";
import { ExpireLoyaltyPoints } from "../ExpireLoyaltyPoints";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { NewNotification } from "../../../entities/Notification";
import type { ILoyaltyRepository, PointsExpiry } from "../../../repositories/ILoyaltyRepository";

const NOW = new Date("2026-11-04T09:00:00.000Z");

/** Expiry on, after 12 months, since long before anyone's last visit. */
const EXPIRING: LoyaltySettings = {
  ...DEFAULT_LOYALTY_SETTINGS,
  pointsExpiryMonths: 12,
  pointsExpirySince: "2024-01-01T00:00:00.000Z",
};

/** Idle since well over a year ago: due now. */
const DUE: LapsingPoints = { userId: "09120000001", balance: 340, lastActivityAt: "2025-10-01T08:00:00.000Z" };
/** Lapses in 10 days: warned, not taken. */
const SOON: LapsingPoints = { userId: "09120000002", balance: 75, lastActivityAt: "2025-11-14T08:00:00.000Z" };
/** Lapses in a month: neither. */
const LATER: LapsingPoints = { userId: "09120000003", balance: 20, lastActivityAt: "2025-12-04T08:00:00.000Z" };

function setup(settings: LoyaltySettings = EXPIRING, candidates: LapsingPoints[] = [DUE, SOON, LATER]) {
  const entries: (NewActivityEntry | null)[] = [];
  const expire = vi.fn<ILoyaltyRepository["expire"]>(async (expiry: PointsExpiry, audit) => {
    if (audit)
      entries.push(audit({ id: "t", userId: expiry.userId, delta: -expiry.balance, reason: "expire", createdAt: "" }));
    return expiry.balance;
  });
  const listLapsing = vi.fn<ILoyaltyRepository["listLapsing"]>(async () => candidates);
  const sent: NewNotification[] = [];
  const notifier = { notify: vi.fn(async (notification: NewNotification) => void sent.push(notification)) };
  const job = new ExpireLoyaltyPoints({ getSettings: vi.fn(async () => settings), listLapsing, expire }, notifier);
  return { job, expire, listLapsing, sent, entries };
}

describe("ExpireLoyaltyPoints", () => {
  it("does nothing while expiry is off (the default) or the club is paused", async () => {
    for (const settings of [DEFAULT_LOYALTY_SETTINGS, { ...EXPIRING, enabled: false }]) {
      const { job, listLapsing, expire } = setup(settings);
      expect(await job.execute(NOW)).toBe(0);
      expect(listLapsing).not.toHaveBeenCalled();
      expect(expire).not.toHaveBeenCalled();
    }
  });

  it("takes the balance of a guest idle past the expiry, logs it under the system, and tells them", async () => {
    const { job, expire, sent, entries } = setup();
    expect(await job.execute(NOW)).toBe(1);

    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire.mock.calls[0][0]).toMatchObject({ ...DUE, note: "No activity for 12 months" });
    expect(entries).toEqual([
      expect.objectContaining({
        actorId: "system",
        action: "loyalty.pointsExpired",
        entityType: "loyalty",
        entityId: DUE.userId,
        changes: [{ field: "points", before: "340", after: "0" }],
      }),
    ]);
    expect(sent).toContainEqual(
      expect.objectContaining({ userId: DUE.userId, kind: "pointsExpired", params: { points: 340 }, link: "/rewards" }),
    );
  });

  it("warns a guest whose points lapse within the warning days, once per stretch of inactivity", async () => {
    const { job, sent } = setup();
    await job.execute(NOW);
    const warning = sent.find((notification) => notification.kind === "pointsExpiring");
    expect(warning).toEqual({
      userId: SOON.userId,
      kind: "pointsExpiring",
      params: { points: 75, expiresAt: "2026-11-14T08:00:00.000Z" },
      link: "/rewards",
      dedupeKey: `points:${SOON.userId}:expiring:${SOON.lastActivityAt}`,
    });
    expect(sent.some((notification) => notification.userId === LATER.userId)).toBe(false);
  });

  it("counts inactivity from the day expiry was switched on", async () => {
    const { job, expire, sent } = setup({ ...EXPIRING, pointsExpirySince: "2026-06-01T00:00:00.000Z" });
    expect(await job.execute(NOW)).toBe(0);
    expect(expire).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("doesn't tell a guest whose points were kept by a visit the job didn't see", async () => {
    const { job, expire, sent } = setup(EXPIRING, [DUE]);
    expire.mockResolvedValueOnce(0);
    expect(await job.execute(NOW)).toBe(0);
    expect(sent).toEqual([]);
  });
});

describe("GetGuestLoyaltyOverview", () => {
  function repo(settings: LoyaltySettings, balance: number, lastActivity?: string) {
    return {
      getSettings: vi.fn(async () => settings),
      balance: vi.fn(async () => balance),
      history: vi.fn(async () => []),
      lastActivity: vi.fn(async () => lastActivity),
    } as unknown as ILoyaltyRepository;
  }

  it("says when the balance lapses, once expiry is on", async () => {
    const overview = await new GetGuestLoyaltyOverview(repo(EXPIRING, 120, "2026-03-15T08:00:00.000Z")).execute("g1");
    expect(overview).toMatchObject({ balance: 120, expiresAt: "2027-03-15T08:00:00.000Z" });
  });

  it("says nothing with expiry off or no points to lose", async () => {
    expect(
      (await new GetGuestLoyaltyOverview(repo(DEFAULT_LOYALTY_SETTINGS, 120, "2026-03-15T08:00:00.000Z")).execute("g1"))
        .expiresAt,
    ).toBeUndefined();
    expect(
      (await new GetGuestLoyaltyOverview(repo(EXPIRING, 0, "2026-03-15T08:00:00.000Z")).execute("g1")).expiresAt,
    ).toBeUndefined();
  });
});
