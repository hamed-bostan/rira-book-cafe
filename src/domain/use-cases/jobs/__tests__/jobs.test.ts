import { describe, expect, it, vi } from "vitest";

import { SYSTEM_ACTOR, type NewActivityEntry } from "../../../entities/ActivityEntry";
import { holdPickupDeadline, type BookWaitlistEntry } from "../../../entities/BookWaitlist";
import { wallTimeToDate } from "../../../entities/CafeTime";
import { ExpireBookHolds } from "../ExpireBookHolds";
import { ExpireSuiteRequests, ExpireTableRequests } from "../ExpireRequests";
import { forEachSettled } from "../forEachSettled";
import { SendHoldReminders, SendTableReminders } from "../SendReminders";

import type { NewNotification } from "../../../entities/Notification";
import type { Reservation } from "../../../entities/Reservation";
import type { SuiteBooking } from "../../../entities/SuiteBooking";
import type { AuditHook } from "../../../repositories/AuditHook";
import type { ICustomerNotifier } from "../../../repositories/INotificationRepository";

const iso = (wallTime: string): string => wallTimeToDate(wallTime).toISOString();

/** An inbox that keeps one notification per key, as the real one does. */
function inbox(): ICustomerNotifier & { sent: NewNotification[] } {
  const sent: NewNotification[] = [];
  return {
    sent,
    notify: vi.fn(async (notification: NewNotification) => {
      if (!sent.some((other) => other.dedupeKey && other.dedupeKey === notification.dedupeKey)) {
        sent.push(notification);
      }
    }),
  };
}

function request(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "r1",
    reference: 12,
    guestName: "Sara",
    guestPhone: "0912 345 6789",
    partySize: 2,
    startsAt: iso("2026-11-05T19:30"),
    durationMinutes: 90,
    status: "requested",
    createdAt: iso("2026-11-01T10:00"),
    updatedAt: iso("2026-11-01T10:00"),
    ...overrides,
  };
}

describe("ExpireTableRequests", () => {
  function repo(requests: Reservation[], audits: NewActivityEntry[] = []) {
    return {
      listBetween: vi.fn(async () => requests),
      expireRequest: vi.fn(async (id: string, at: Date, audit?: AuditHook<Reservation>) => {
        const current = requests.find((r) => r.id === id);
        if (!current) return null;
        const saved = { ...current, status: "cancelled" as const, expiredAt: at.toISOString() };
        const entry = audit?.(saved);
        if (entry) audits.push(entry);
        return saved;
      }),
    };
  }

  it("cancels a request nobody answered by its start, under the system actor, and tells the guest", async () => {
    const audits: NewActivityEntry[] = [];
    const reservations = repo([request()], audits);
    const notifier = inbox();
    const now = wallTimeToDate("2026-11-05T19:30");

    expect(await new ExpireTableRequests(reservations, notifier).execute(now)).toBe(1);
    expect(reservations.expireRequest).toHaveBeenCalledWith("r1", now, expect.any(Function));
    expect(audits).toEqual([
      {
        actorId: SYSTEM_ACTOR.id,
        actorName: SYSTEM_ACTOR.name,
        action: "reservation.expired",
        entityType: "reservation",
        entityId: "r1",
        entityLabel: "R-12",
        changes: [{ field: "status", before: "requested", after: "cancelled" }],
      },
    ]);
    expect(notifier.sent).toEqual([
      expect.objectContaining({
        userId: "09123456789",
        kind: "reservationExpired",
        dedupeKey: "reservation:r1:expired",
      }),
    ]);
  });

  it("leaves a request whose time hasn't come", async () => {
    const reservations = repo([request()]);
    const now = wallTimeToDate("2026-11-05T19:29");
    expect(await new ExpireTableRequests(reservations, inbox()).execute(now)).toBe(0);
    expect(reservations.expireRequest).not.toHaveBeenCalled();
  });

  it("tells nobody about a request staff answered a moment before", async () => {
    const reservations = { listBetween: vi.fn(async () => [request()]), expireRequest: vi.fn(async () => null) };
    const notifier = inbox();
    expect(await new ExpireTableRequests(reservations, notifier).execute(wallTimeToDate("2026-11-06T10:00"))).toBe(0);
    expect(notifier.sent).toEqual([]);
  });

  it("gets through the rest when one fails, then reports it", async () => {
    const reservations = repo([request({ id: "bad" }), request({ id: "r2", reference: 13 })]);
    const original = reservations.expireRequest.getMockImplementation();
    reservations.expireRequest.mockImplementation(async (id, at, audit) => {
      if (id === "bad") throw new Error("database hiccup");
      return original!(id, at, audit);
    });
    const notifier = inbox();
    await expect(
      new ExpireTableRequests(reservations, notifier).execute(wallTimeToDate("2026-11-06T10:00")),
    ).rejects.toBeInstanceOf(AggregateError);
    expect(notifier.sent.map((n) => n.dedupeKey)).toEqual(["reservation:r2:expired"]);
  });
});

describe("ExpireSuiteRequests", () => {
  const stay = (checkIn: string): SuiteBooking => ({
    id: `s-${checkIn}`,
    reference: 4,
    guestName: "Hamid",
    guestPhone: "09351112233",
    guests: 2,
    checkIn,
    checkOut: "2026-11-09",
    status: "requested",
    createdAt: iso("2026-11-01T10:00"),
    updatedAt: iso("2026-11-01T10:00"),
  });

  it("cancels a stay request once its arrival day is over, not on the day", async () => {
    const suites = {
      listRequestsArrivingBefore: vi.fn(async () => [stay("2026-11-04"), stay("2026-11-05")]),
      expireRequest: vi.fn(async (id: string) => ({ ...stay(id.slice(2)), status: "cancelled" as const })),
    };
    const notifier = inbox();
    const now = wallTimeToDate("2026-11-05T09:00");

    expect(await new ExpireSuiteRequests(suites, notifier).execute(now)).toBe(1);
    expect(suites.listRequestsArrivingBefore).toHaveBeenCalledWith("2026-11-05");
    expect(suites.expireRequest).toHaveBeenCalledTimes(1);
    expect(suites.expireRequest).toHaveBeenCalledWith("s-2026-11-04", "2026-11-05", now, expect.any(Function));
    expect(notifier.sent.map((n) => n.kind)).toEqual(["suiteExpired"]);
  });
});

describe("ExpireBookHolds", () => {
  const toldAt = wallTimeToDate("2026-11-03T10:00");
  const hold = (overrides: Partial<BookWaitlistEntry> = {}): BookWaitlistEntry => ({
    id: "w1",
    productId: "b1",
    bookTitle: "The Blind Owl",
    guestName: "Sara",
    guestPhone: "09351112233",
    status: "notified",
    notifiedAt: toldAt.toISOString(),
    pickupBy: holdPickupDeadline(toldAt).toISOString(),
    createdAt: iso("2026-10-20T10:00"),
    updatedAt: toldAt.toISOString(),
    ...overrides,
  });
  const next = hold({ id: "w2", userId: "09124041180", guestName: "Hamid", guestPhone: "09124041180" });

  function waitlist(open: BookWaitlistEntry[]) {
    return {
      listOpen: vi.fn(async () => open),
      expireHold: vi.fn(async (id: string, at: Date) => ({
        ...open.find((entry) => entry.id === id)!,
        status: "cancelled" as const,
        expiredAt: at.toISOString(),
      })),
      notifyNext: vi.fn(async () => next),
    };
  }

  it("skips a told guest whose deadline has gone, tells them, and passes the copy on", async () => {
    const holds = waitlist([hold(), hold({ id: "w3", status: "waiting", notifiedAt: undefined, pickupBy: undefined })]);
    const notifier = inbox();
    const now = wallTimeToDate("2026-11-07T00:05");

    expect(await new ExpireBookHolds(holds, notifier).execute(now)).toBe(1);
    expect(holds.expireHold).toHaveBeenCalledTimes(1);
    expect(holds.expireHold).toHaveBeenCalledWith("w1", now, expect.any(Function));
    expect(holds.notifyNext).toHaveBeenCalledWith("b1", now);
    expect(notifier.sent.map((n) => [n.kind, n.userId])).toEqual([
      ["holdExpired", "09351112233"],
      ["bookAvailable", "09124041180"],
    ]);
  });

  it("leaves a guest whose last day isn't over", async () => {
    const holds = waitlist([hold()]);
    expect(await new ExpireBookHolds(holds, inbox()).execute(wallTimeToDate("2026-11-06T23:59"))).toBe(0);
    expect(holds.expireHold).not.toHaveBeenCalled();
  });

  it("passes nothing on when they borrowed it a moment before", async () => {
    const holds = { ...waitlist([hold()]), expireHold: vi.fn(async () => null) };
    const notifier = inbox();
    expect(await new ExpireBookHolds(holds, notifier).execute(wallTimeToDate("2026-11-08T10:00"))).toBe(0);
    expect(holds.notifyNext).not.toHaveBeenCalled();
    expect(notifier.sent).toEqual([]);
  });
});

describe("the reminder jobs", () => {
  it("send each reminder once, however often they run", async () => {
    const confirmed = request({ status: "confirmed" });
    const reservations = { listBetween: vi.fn(async () => [confirmed]) };
    const notifier = inbox();
    const job = new SendTableReminders(reservations, notifier);

    await job.execute(wallTimeToDate("2026-11-04T18:00"));
    await job.execute(wallTimeToDate("2026-11-04T18:05"));
    await job.execute(wallTimeToDate("2026-11-04T18:10"));
    expect(notifier.sent.map((n) => n.kind)).toEqual(["reservationTomorrow"]);
  });

  it("look two days ahead for tables", async () => {
    const reservations = { listBetween: vi.fn(async () => []) };
    const now = wallTimeToDate("2026-11-04T18:00");
    await new SendTableReminders(reservations, inbox()).execute(now);
    expect(reservations.listBetween).toHaveBeenCalledWith(
      now,
      new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      "confirmed",
    );
  });

  it("remind told guests to collect, from the open lines", async () => {
    const toldAt = wallTimeToDate("2026-11-03T10:00");
    const entry: BookWaitlistEntry = {
      id: "w1",
      productId: "b1",
      bookTitle: "The Blind Owl",
      guestName: "Sara",
      guestPhone: "09351112233",
      status: "notified",
      notifiedAt: toldAt.toISOString(),
      pickupBy: holdPickupDeadline(toldAt).toISOString(),
      createdAt: toldAt.toISOString(),
      updatedAt: toldAt.toISOString(),
    };
    const notifier = inbox();
    const job = new SendHoldReminders({ listOpen: vi.fn(async () => [entry]) }, notifier);
    await job.execute(wallTimeToDate("2026-11-03T10:05"));
    await job.execute(wallTimeToDate("2026-11-06T08:00"));
    expect(notifier.sent.map((n) => n.kind)).toEqual(["holdCollectBy", "holdLastDay"]);
  });
});

describe("forEachSettled", () => {
  it("runs every item and throws the failures together", async () => {
    const seen: number[] = [];
    const run = forEachSettled([1, 2, 3], async (n) => {
      seen.push(n);
      if (n !== 2) throw new Error(`no ${n}`);
    });
    await expect(run).rejects.toMatchObject({
      message: "2 of 3 failed",
      errors: [new Error("no 1"), new Error("no 3")],
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});
