import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isPlausiblePhone, normalizePhone } from "@/src/domain/entities/Phone";
import { PLACEHOLDER_USER_NAME } from "@/src/domain/entities/User";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

/**
 * The backfill migration, run as deploy runs it, over records made before guest
 * profiles: every one with a usable phone ends up on the profile `normalizePhone`
 * would give that phone — the one its guest lands in when they sign in.
 */
const BACKFILL = readFileSync(
  join(process.cwd(), "prisma/migrations/20261108000000_guest_profiles_backfill/migration.sql"),
  "utf8",
)
  .trim()
  // One DO block; the driver takes it without the closing semicolon.
  .replace(/;$/, "");

function runBackfill(): Promise<number> {
  return prisma.$executeRawUnsafe(BACKFILL);
}

const BOOK = "seed-book-blind-owl";

/** How staff typed numbers before profiles: Persian and Arabic digits, +98, 0098, spaces, dashes, brackets. */
const TYPED_PHONES = [
  "۰۹۱۲ ۳۴۵ ۶۷۸۹",
  "+98 912 345 6788",
  "0098 912 345 6787",
  "٠٩١٢-٣٤٥-٦٧٨٦",
  " 0912 345 6785 ",
  "98-912-345-6784",
  "(0912) 345 6783",
  "+44 7700 900123",
  "981234567890",
  "۰۹۱۲۳۴۵۶۷۸۲",
  "12",
  "",
];

const day = (offset: number): Date => new Date(Date.now() + offset * 24 * 60 * 60 * 1000);

/** An old table booking: a name and a phone, no profile. */
function oldBooking(guestPhone: string, guestName = "Booked Guest", createdAt = day(-3)) {
  return prisma.reservation.create({
    data: { guestName, guestPhone, partySize: 2, startsAt: day(3), durationMinutes: 90, createdAt },
  });
}

/** An old counter sale. */
function oldSale(customerPhone: string, customerName = "Walk-in guest", placedAt = day(-1)) {
  return prisma.order.create({
    data: { customerName, customerPhone, serviceType: "takeaway", subtotal: 95000, total: 95000, placedAt },
  });
}

describe("the guest-profile backfill", () => {
  it("puts every old record with a usable phone on the profile normalizePhone gives it", async () => {
    const bookings = await Promise.all(TYPED_PHONES.map((phone, i) => oldBooking(phone, `Guest ${"abcdefghijkl"[i]}`)));
    const stay = await prisma.suiteBooking.create({
      data: {
        guestName: "Stay Guest",
        guestPhone: "۰۹۳۵ ۱۱۱ ۰۰۰۱",
        guests: 2,
        checkIn: new Date("2027-01-10"),
        checkOut: new Date("2027-01-12"),
      },
    });
    const loan = await prisma.bookLoan.create({
      data: {
        productId: BOOK,
        bookTitle: "The Blind Owl",
        borrowerName: "Loan Guest",
        borrowerPhone: "+98 935 111 0002",
        lentAt: day(-2),
        dueAt: day(12),
        lentById: TEST_USERS.staff.id,
        lentByName: TEST_USERS.staff.name,
      },
    });
    const hold = await prisma.bookWaitlistEntry.create({
      data: { productId: BOOK, bookTitle: "The Blind Owl", guestName: "Hold Guest", guestPhone: "0935-111-0003" },
    });
    const sale = await oldSale("0098 935 111 0004", "Sale Guest");

    await runBackfill();

    for (const [i, booking] of bookings.entries()) {
      const phone = TYPED_PHONES[i];
      const { userId } = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } });
      expect(userId, phone).toBe(isPlausiblePhone(phone) ? normalizePhone(phone) : null);
    }
    expect((await prisma.suiteBooking.findUniqueOrThrow({ where: { id: stay.id } })).userId).toBe("09351110001");
    expect((await prisma.bookLoan.findUniqueOrThrow({ where: { id: loan.id } })).userId).toBe("09351110002");
    expect((await prisma.bookWaitlistEntry.findUniqueOrThrow({ where: { id: hold.id } })).userId).toBe("09351110003");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: sale.id } })).userId).toBe("00989351110004");

    // Each profile is named from its record, typed phone and all, and nobody has signed in to it.
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "09123456789" } })).toMatchObject({
      phone: "۰۹۱۲ ۳۴۵ ۶۷۸۹",
      name: "Guest a",
      role: "customer",
      createdById: null,
      firstSignedInAt: null,
    });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "09123456785" } })).toMatchObject({
      phone: "0912 345 6785",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "00989351110004" } })).name).toBe("Sale Guest");
    const made = [
      ...TYPED_PHONES.filter(isPlausiblePhone).map(normalizePhone),
      "09351110001",
      "09351110002",
      "09351110003",
      "00989351110004",
    ];
    expect(made).toHaveLength(14);
    expect(await prisma.user.count({ where: { id: { in: made }, createdById: null, firstSignedInAt: null } })).toBe(14);
  });

  it("attaches a record to a profile that's already there, and leaves the profile as it is", async () => {
    const booking = await oldBooking("+98 912 000 0004", "Someone Else");
    const before = await prisma.user.findUniqueOrThrow({ where: { id: TEST_USERS.customer.id } });

    await runBackfill();

    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } })).userId).toBe(
      TEST_USERS.customer.id,
    );
    expect(await prisma.user.findUniqueOrThrow({ where: { id: TEST_USERS.customer.id } })).toEqual(before);
  });

  it("names a profile from a booking before a sale, the latest first, and a walk-in sale's guest not at all", async () => {
    await oldBooking("09351110010", "Older Name", day(-9));
    await oldBooking("09351110010", "Newer Name", day(-5));
    await oldSale("09351110010", "Sale Name", day(-1));
    await oldSale("09351110011", "Walk-in guest");
    await oldSale("09351110012", "مهمان حضوری");

    await runBackfill();

    expect((await prisma.user.findUniqueOrThrow({ where: { id: "09351110010" } })).name).toBe("Newer Name");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "09351110011" } })).name).toBe(PLACEHOLDER_USER_NAME);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "09351110012" } })).name).toBe(PLACEHOLDER_USER_NAME);
  });

  it("runs again without changing anything, and keeps a guest to one open hold per book", async () => {
    await oldBooking("0935 111 0020", "Twice Guest");
    // The test guest holds the book on their profile, and staff once added a hold for the same number.
    await prisma.bookWaitlistEntry.create({
      data: {
        productId: BOOK,
        bookTitle: "The Blind Owl",
        userId: TEST_USERS.customer.id,
        guestName: TEST_USERS.customer.name,
        guestPhone: TEST_USERS.customer.phone,
      },
    });
    const second = await prisma.bookWaitlistEntry.create({
      data: { productId: BOOK, bookTitle: "The Blind Owl", guestName: "Test Guest", guestPhone: "0912 000 0004" },
    });

    await runBackfill();
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    const bookings = await prisma.reservation.findMany({ orderBy: { id: "asc" } });
    await runBackfill();

    expect(await prisma.user.findMany({ orderBy: { id: "asc" } })).toEqual(users);
    expect(await prisma.reservation.findMany({ orderBy: { id: "asc" } })).toEqual(bookings);
    expect(bookings.every((booking) => booking.userId === "09351110020")).toBe(true);
    // A second open hold on the same book can't be theirs too: it stays as it was, by its phone.
    expect((await prisma.bookWaitlistEntry.findUniqueOrThrow({ where: { id: second.id } })).userId).toBeNull();
  });
});
