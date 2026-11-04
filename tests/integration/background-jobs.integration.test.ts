import { describe, expect, it } from "vitest";

import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { POST as lend } from "@/app/api/admin/book-loans/route";
import { GET as listHolds, POST as addHold } from "@/app/api/admin/book-waitlist/route";
import { POST as joinLine } from "@/app/api/products/[id]/waitlist/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import { holdPickupDeadline, type BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { eveningBefore } from "@/src/domain/entities/Reminder";
import { SyncLoanReminders } from "@/src/domain/use-cases/notifications/NotificationQueries";
import { bookLoanRepository, customerNotifier } from "@/src/infrastructure/container";
import { createBackgroundJobs } from "@/src/infrastructure/jobs/backgroundJobs";
import { PostgresJobLock } from "@/src/infrastructure/jobs/PostgresJobLock";
import { prisma } from "@/src/infrastructure/prisma/client";
import { lockBookShelf } from "@/src/infrastructure/repositories/bookShelf";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * The background jobs against a real database: each job's use-case wired to the
 * Prisma repositories, run at chosen instants (the runner's timer is off in tests).
 * Times are far enough ahead that the seeded events and today's real clock stay
 * out of the way.
 */

const BLIND_OWL = "seed-book-blind-owl";
/** A guest with no account: the jobs reach them by phone all the same. */
const PHONE_ONLY = "09351112233";
const CUSTOMER = TEST_USERS.customer;

async function runJobs(now: Date): Promise<void> {
  for (const job of createBackgroundJobs()) await job.run(now);
}

function inbox(userId: string): Promise<{ kind: string; dedupeKey: string | null }[]> {
  return prisma.notification.findMany({
    where: { userId },
    select: { kind: true, dedupeKey: true },
    orderBy: { createdAt: "asc" },
  });
}

async function kindsFor(userId: string): Promise<string[]> {
  return (await inbox(userId)).map((notification) => notification.kind);
}

function table(startsAt: string, status: "requested" | "confirmed", createdAt = "2027-03-01T10:00") {
  return prisma.reservation.create({
    data: {
      guestName: "Sara Ahmadi",
      guestPhone: "0935 111 2233",
      partySize: 2,
      startsAt: wallTimeToDate(startsAt),
      durationMinutes: 90,
      status,
      tableLabel: status === "confirmed" ? "3" : null,
      createdAt: wallTimeToDate(createdAt),
    },
  });
}

function stay(checkIn: string, status: "requested" | "confirmed") {
  return prisma.suiteBooking.create({
    data: {
      guestName: "Omid Karimi",
      guestPhone: PHONE_ONLY,
      guests: 2,
      checkIn: new Date(`${checkIn}T00:00:00Z`),
      checkOut: new Date(`${shiftCafeDay(checkIn, 2)}T00:00:00Z`),
      status,
      createdAt: wallTimeToDate("2027-03-01T10:00"),
    },
  });
}

function lendTo(phone: string, dueOn: string): Promise<Response> {
  return lend(
    jsonRequest("POST", "/api/admin/book-loans", {
      productId: BLIND_OWL,
      borrowerName: "Niloofar",
      borrowerPhone: phone,
      dueOn,
      note: "",
    }),
  );
}

describe("the reminder jobs", () => {
  it("remind a confirmed table the evening before and two hours before, by phone, once each", async () => {
    await table("2027-03-11T19:30", "confirmed");

    await runJobs(wallTimeToDate("2027-03-10T17:59"));
    expect(await kindsFor(PHONE_ONLY)).toEqual([]);

    await runJobs(wallTimeToDate("2027-03-10T18:00"));
    await runJobs(wallTimeToDate("2027-03-10T18:05"));
    expect(await kindsFor(PHONE_ONLY)).toEqual(["reservationTomorrow"]);

    await runJobs(wallTimeToDate("2027-03-11T17:30"));
    await runJobs(wallTimeToDate("2027-03-11T17:35"));
    expect(await kindsFor(PHONE_ONLY)).toEqual(["reservationTomorrow", "reservationSoon"]);
  });

  it("skip a table booked after its reminder's moment rather than sending it late", async () => {
    await table("2027-03-11T19:30", "confirmed", "2027-03-11T18:45");
    for (const now of ["2027-03-11T18:45", "2027-03-11T18:50", "2027-03-11T19:00"]) {
      await runJobs(wallTimeToDate(now));
    }
    expect(await kindsFor(PHONE_ONLY)).toEqual([]);
  });

  it("remind a suite guest and an event's sign-ups the evening before", async () => {
    await stay("2027-03-11", "confirmed");
    const event = await prisma.event.create({
      data: {
        kind: "bookClub",
        title: "Spring book club",
        titleFa: "باشگاه کتاب بهاری",
        startsAt: wallTimeToDate("2027-03-11T17:00"),
        endsAt: wallTimeToDate("2027-03-11T19:00"),
        isPublished: true,
      },
    });
    await prisma.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: CUSTOMER.id,
        guestName: CUSTOMER.name,
        guestPhone: CUSTOMER.phone,
        seats: 2,
        createdAt: wallTimeToDate("2027-03-02T10:00"),
      },
    });

    await runJobs(eveningBefore("2027-03-11"));

    expect(await kindsFor(PHONE_ONLY)).toEqual(["suiteTomorrow"]);
    const [reminder] = await prisma.notification.findMany({ where: { userId: CUSTOMER.id } });
    expect(reminder).toMatchObject({
      kind: "eventTomorrow",
      params: { title: "Spring book club", titleFa: "باشگاه کتاب بهاری", seats: 2 },
      link: `/events/${event.id}`,
    });
  });

  it("remind a borrower who hasn't signed in yet that a book's due tomorrow, then that it's overdue", async () => {
    signInAs("admin");
    const dueOn = shiftCafeDay(cafeDayOf(new Date()), 3);
    const loan = await readJson<BookLoan>(await lendTo("0935 111 2233", dueOn));
    // On the profile made with the loan, though they've never signed in.
    expect(loan.userId).toBe(PHONE_ONLY);

    // Lending already told them, by their phone, that the book went home with them.
    expect(await kindsFor(PHONE_ONLY)).toEqual(["loanStarted"]);

    await runJobs(eveningBefore(dueOn));
    expect(await inbox(PHONE_ONLY)).toEqual([
      { kind: "loanStarted", dedupeKey: `loan:${loan.id}:started` },
      { kind: "loanDueSoon", dedupeKey: `loan:${loan.id}:loanDueSoon` },
    ]);

    await runJobs(new Date(new Date(loan.dueAt).getTime() + 1));
    expect(await kindsFor(PHONE_ONLY)).toEqual(["loanStarted", "loanDueSoon", "loanOverdue"]);
  });

  it("share the loan reminder's key with the inbox's own, so an account holder gets it once", async () => {
    signInAs("admin");
    const dueOn = shiftCafeDay(cafeDayOf(new Date()), 3);
    await lendTo(CUSTOMER.phone, dueOn);

    const moment = eveningBefore(dueOn);
    await runJobs(moment);
    // The guest opening their notifications works the same reminder out.
    await new SyncLoanReminders(bookLoanRepository, customerNotifier).execute(CUSTOMER.id, moment);
    expect(await kindsFor(CUSTOMER.id)).toEqual(["loanStarted", "loanDueSoon"]);
  });
});

describe("expiring requests", () => {
  it("cancel a table request nobody answered by its start, log it under the system actor, and tell the guest", async () => {
    const request = await table("2027-03-10T12:00", "requested");
    const confirmed = await table("2027-03-10T12:00", "confirmed");

    await runJobs(wallTimeToDate("2027-03-10T11:59"));
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("requested");

    const now = wallTimeToDate("2027-03-10T12:00");
    await runJobs(now);

    expect(await prisma.reservation.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
      status: "cancelled",
      expiredAt: now,
    });
    expect(await prisma.reservation.findUniqueOrThrow({ where: { id: confirmed.id } })).toMatchObject({
      status: "confirmed",
      expiredAt: null,
    });
    expect(await prisma.activityEntry.findMany({ where: { action: "reservation.expired" } })).toEqual([
      expect.objectContaining({
        actorId: "system",
        actorName: "System",
        entityType: "reservation",
        entityId: request.id,
        entityLabel: `R-${request.reference}`,
        changes: [{ field: "status", before: "requested", after: "cancelled" }],
      }),
    ]);
    expect(await inbox(PHONE_ONLY)).toEqual([
      { kind: "reservationExpired", dedupeKey: `reservation:${request.id}:expired` },
    ]);
  });

  it("cancel a stay request once its arrival day is over, not during it", async () => {
    const request = await stay("2027-03-10", "requested");

    await runJobs(wallTimeToDate("2027-03-10T23:59"));
    expect((await prisma.suiteBooking.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("requested");

    await runJobs(wallTimeToDate("2027-03-11T00:05"));
    expect(await prisma.suiteBooking.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
      status: "cancelled",
      expiredAt: wallTimeToDate("2027-03-11T00:05"),
    });
    expect(await prisma.activityEntry.findFirstOrThrow({ where: { action: "suiteBooking.expired" } })).toMatchObject({
      actorId: "system",
      entityId: request.id,
      entityLabel: `S-${request.reference}`,
    });
    expect(await kindsFor(PHONE_ONLY)).toEqual(["suiteExpired"]);
  });

  it("refuse an expired mark on anything but a cancelled booking", async () => {
    const booking = await table("2027-03-10T12:00", "confirmed");
    await expect(
      prisma.reservation.update({ where: { id: booking.id }, data: { expiredAt: new Date() } }),
    ).rejects.toThrow(/reservations_expired_chk/);
  });
});

describe("the pickup deadline for held books", () => {
  /** A book out with two guests in line, which comes back: the first is told. */
  async function toldLine(): Promise<{ first: BookWaitlistEntry; second: BookWaitlistEntry }> {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo("09121110005", shiftCafeDay(cafeDayOf(new Date()), 14)));
    const first = await readJson<BookWaitlistEntry>(
      await addHold(
        jsonRequest("POST", "/api/admin/book-waitlist", {
          productId: BLIND_OWL,
          guestName: "Sara",
          guestPhone: PHONE_ONLY,
        }),
      ),
    );
    signInAs("customer");
    const second = await readJson<BookWaitlistEntry>(
      await joinLine(jsonRequest("POST", `/api/products/${BLIND_OWL}/waitlist`), routeParams({ id: BLIND_OWL })),
    );
    signInAs("admin");
    await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned" }),
      routeParams({ id: loan.id }),
    );
    return { first, second };
  }

  async function line(): Promise<BookWaitlistEntry[]> {
    signInAs("admin");
    const open = await readJson<BookWaitlistEntry[]>(await listHolds(getRequest("/api/admin/book-waitlist")));
    return open.filter((entry) => entry.productId === BLIND_OWL);
  }

  it("is stamped when the guest is told, and shown to staff", async () => {
    const { first } = await toldLine();
    const [told] = await line();
    expect(told.id).toBe(first.id);
    expect(told.status).toBe("notified");
    expect(told.pickupBy).toBe(holdPickupDeadline(new Date(told.notifiedAt!)).toISOString());
  });

  it("skips a guest who didn't collect in time, under the shelf's lock, and passes the copy on", async () => {
    const { first, second } = await toldLine();
    const [told] = await line();
    const now = new Date(new Date(told.pickupBy!).getTime() + 1);

    // Someone else is moving the book's copies: the skip waits its turn.
    let release = (): void => undefined;
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked = (): void => undefined;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const lending = prisma.$transaction(
      async (tx) => {
        await lockBookShelf(tx, BLIND_OWL);
        locked();
        await released;
      },
      { timeout: 10_000 },
    );
    await lockTaken;
    let done = false;
    const running = runJobs(now).then(() => {
      done = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(done).toBe(false);
    release();
    await lending;
    await running;

    const skipped = await prisma.bookWaitlistEntry.findUniqueOrThrow({ where: { id: first.id } });
    expect(skipped).toMatchObject({ status: "cancelled", expiredAt: now });
    const [next] = await line();
    expect(next).toMatchObject({ id: second.id, status: "notified" });
    expect(next.pickupBy).toBe(holdPickupDeadline(now).toISOString());

    expect(await prisma.activityEntry.findFirstOrThrow({ where: { action: "bookLoan.holdExpired" } })).toMatchObject({
      actorId: "system",
      entityType: "bookLoan",
      entityId: first.id,
      entityLabel: "Sara (The Blind Owl)",
    });
    expect(await kindsFor(PHONE_ONLY)).toContain("holdExpired");
    // The next guest hears the copy is theirs, and by when — in the same run.
    expect(await kindsFor(CUSTOMER.id)).toEqual(expect.arrayContaining(["bookAvailable", "holdCollectBy"]));
  });

  it("leaves a guest whose last day isn't over, and tells them it's the last day", async () => {
    const { first } = await toldLine();
    const [told] = await line();
    await runJobs(new Date(told.pickupBy!));
    expect((await prisma.bookWaitlistEntry.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("notified");
    const kinds = await kindsFor(PHONE_ONLY);
    expect(kinds).toContain("holdLastDay");
    expect(kinds).not.toContain("holdExpired");
  });
});

describe("a run", () => {
  it("sends and changes nothing new when it runs again straight after", async () => {
    await table("2027-03-10T12:00", "requested");
    await table("2027-03-11T19:30", "confirmed");
    await stay("2027-03-09", "requested");
    await stay("2027-03-11", "confirmed");
    const now = wallTimeToDate("2027-03-10T18:00");

    await runJobs(now);
    const counts = async () => ({
      notifications: await prisma.notification.count(),
      activity: await prisma.activityEntry.count(),
      cancelled: await prisma.reservation.count({ where: { status: "cancelled" } }),
    });
    const first = await counts();
    expect(first.notifications).toBeGreaterThanOrEqual(4);

    await runJobs(now);
    await runJobs(new Date(now.getTime() + 5 * 60 * 1000));
    expect(await counts()).toEqual(first);
  });

  it("takes the lock, so a second instance's run is skipped while one is going", async () => {
    const lock = new PostgresJobLock("rira:background-jobs:test", 10_000);
    let finish = (): void => undefined;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    let started = (): void => undefined;
    const running = new Promise<void>((resolve) => (started = resolve));

    const first = lock.runExclusive(async () => {
      started();
      await finished;
    });
    await running;
    expect(await lock.runExclusive(async () => undefined)).toBe(false);
    finish();
    expect(await first).toBe(true);
    expect(await lock.runExclusive(async () => undefined)).toBe(true);
  });
});
