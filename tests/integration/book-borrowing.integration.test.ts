import { describe, expect, it } from "vitest";

import { POST as lend } from "@/app/api/admin/book-loans/route";
import { POST as lendHold } from "@/app/api/admin/book-waitlist/[id]/lend/route";
import { GET as listHolds, POST as addHold } from "@/app/api/admin/book-waitlist/route";
import { GET as myLoans } from "@/app/api/book-loans/route";
import { POST as borrow } from "@/app/api/products/[id]/borrow/route";
import { GET as lineStatus, POST as joinLine } from "@/app/api/products/[id]/waitlist/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import {
  holdPickupDeadline,
  type BookWaitlistEntry,
  type BookWaitlistStatus,
} from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { prisma } from "@/src/infrastructure/prisma/client";
import { lockBookShelf } from "@/src/infrastructure/repositories/bookShelf";
import { PrismaBookWaitlistRepository } from "@/src/infrastructure/repositories/PrismaBookWaitlistRepository";

import { TEST_USERS } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const BLIND_OWL = "seed-book-blind-owl";
const today = cafeDayOf(new Date());
const GUEST = TEST_USERS.customer;

function borrowAs(user: "customer" | "staff" | null, productId = BLIND_OWL): Promise<Response> {
  signInAs(user);
  return borrow(jsonRequest("POST", `/api/products/${productId}/borrow`), routeParams({ id: productId }));
}

function lendTo(name: string, phone: string): Promise<Response> {
  signInAs("admin");
  return lend(
    jsonRequest("POST", "/api/admin/book-loans", {
      productId: BLIND_OWL,
      borrowerName: name,
      borrowerPhone: phone,
      dueOn: shiftCafeDay(today, 14),
      note: "",
    }),
  );
}

async function status(): Promise<BookWaitlistStatus> {
  signInAs("customer");
  return readJson<BookWaitlistStatus>(
    await lineStatus(getRequest(`/api/products/${BLIND_OWL}/waitlist`), routeParams({ id: BLIND_OWL })),
  );
}

async function line(view = ""): Promise<BookWaitlistEntry[]> {
  signInAs("admin");
  const entries = await readJson<BookWaitlistEntry[]>(await listHolds(getRequest(`/api/admin/book-waitlist${view}`)));
  return entries.filter((entry) => entry.productId === BLIND_OWL);
}

/** Net debits − credits on an account, across everything posted. */
async function balanceOf(accountCode: string): Promise<number> {
  const sum = await prisma.journalLine.aggregate({ where: { accountCode }, _sum: { debit: true, credit: true } });
  return Number(sum._sum.debit ?? 0) - Number(sum._sum.credit ?? 0);
}

describe("borrowing a book from the site", () => {
  it("holds a free copy for the guest, ready to collect, and tells them the day", async () => {
    expect(await status()).toMatchObject({ onLoan: 0, onShelf: 1, canBorrow: true, canJoin: false, entry: null });

    const before = new Date();
    const response = await borrowAs("customer");
    expect(response.status).toBe(201);
    const hold = await readJson<BookWaitlistEntry>(response);
    expect(hold).toMatchObject({
      productId: BLIND_OWL,
      userId: GUEST.id,
      guestName: GUEST.name,
      guestPhone: GUEST.phone,
      status: "notified",
    });
    expect(new Date(hold.notifiedAt!).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(hold.pickupBy).toBe(holdPickupDeadline(new Date(hold.notifiedAt!)).toISOString());

    // The copy is theirs now: nobody else can borrow it, and the book has a line.
    expect(await status()).toMatchObject({
      onShelf: 1,
      queueLength: 1,
      canBorrow: false,
      canJoin: true,
      position: 1,
      entry: { id: hold.id },
    });
    expect(await line()).toEqual([expect.objectContaining({ id: hold.id, status: "notified" })]);

    const told = await prisma.notification.findMany({ where: { userId: GUEST.id } });
    expect(told.map((notification) => [notification.kind, notification.dedupeKey])).toEqual([
      ["holdCollectBy", `waitlist:${hold.id}:holdCollectBy`],
    ]);
  });

  it("offers the line instead once every copy is out", async () => {
    expect((await lendTo("Niloofar", "09121110005")).status).toBe(201);
    expect(await status()).toMatchObject({ canBorrow: false, canJoin: true });

    const refused = await borrowAs("customer");
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("NO_FREE_COPY");
    signInAs("customer");
    expect(
      (await joinLine(jsonRequest("POST", `/api/products/${BLIND_OWL}/waitlist`), routeParams({ id: BLIND_OWL })))
        .status,
    ).toBe(201);
  });

  it("won't let a guest double up: already holding it, in its line, or with it out", async () => {
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 3 } });
    expect((await borrowAs("customer")).status).toBe(201);
    const again = await borrowAs("customer");
    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("ALREADY_WAITING");

    // Staff have it out, lent at the counter by their phone however it was typed.
    expect((await lendTo("Test Staff", "0912 000 0003")).status).toBe(201);
    const lent = await borrowAs("staff");
    expect(lent.status).toBe(409);
    expect((await readError(lent)).code).toBe("ALREADY_ON_LOAN");
  });

  it("asks a signed-out guest to sign in, and doesn't hold a copy for something that isn't a book", async () => {
    expect((await borrowAs(null)).status).toBe(401);
    expect((await borrowAs("customer", "no-such-book")).status).toBe(404);
    expect(await prisma.bookWaitlistEntry.count()).toBe(0);
  });

  it("holds the copy against lending: a loan to someone else skips the guest, and logs it", async () => {
    const hold = await readJson<BookWaitlistEntry>(await borrowAs("customer"));

    // The copy is held, so the book has a line for a counter guest to join.
    signInAs("admin");
    const counter = await addHold(
      jsonRequest("POST", "/api/admin/book-waitlist", {
        productId: BLIND_OWL,
        guestName: "Hamid",
        guestPhone: "09124041180",
      }),
    );
    expect(counter.status).toBe(201);

    expect((await lendTo("Reza", "09121110006")).status).toBe(201);
    expect((await line("?view=closed")).find((entry) => entry.id === hold.id)?.status).toBe("cancelled");
    const skipped = await prisma.activityEntry.findFirstOrThrow({ where: { action: "bookLoan.holdSkipped" } });
    expect(skipped).toMatchObject({ entityId: hold.id, entityLabel: `${GUEST.name} (The Blind Owl)` });
  });

  it("gives the last free copy to one guest of two borrowing at once", async () => {
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 2 } });
    expect((await lendTo("Niloofar", "09121110005")).status).toBe(201);

    const repo = new PrismaBookWaitlistRepository();
    const now = new Date();
    const results = await Promise.allSettled(
      [TEST_USERS.customer, TEST_USERS.staff].map((user) =>
        repo.borrow(
          {
            productId: BLIND_OWL,
            bookTitle: "The Blind Owl",
            userId: user.id,
            guestName: user.name,
            guestPhone: user.phone,
          },
          now,
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [refused] = results.filter((result) => result.status === "rejected");
    expect(refused.reason).toMatchObject({ code: "NO_FREE_COPY" });
    expect(await line()).toHaveLength(1);
  });

  it("decides only once lending has let go of the book", async () => {
    // A loan of the book in flight: its transaction holds the book's lock until released.
    let release = (): void => undefined;
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked = (): void => undefined;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const lending = prisma.$transaction(
      async (tx) => {
        await lockBookShelf(tx, BLIND_OWL);
        locked();
        await released;
        // It takes the only copy before letting go.
        await tx.bookLoan.create({
          data: {
            productId: BLIND_OWL,
            bookTitle: "The Blind Owl",
            borrowerName: "Niloofar",
            borrowerPhone: "09121110005",
            lentAt: new Date(),
            dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            lentById: TEST_USERS.admin.id,
            lentByName: TEST_USERS.admin.name,
          },
        });
      },
      { timeout: 10_000 },
    );
    await lockTaken;

    let settled = false;
    const borrowing = borrowAs("customer").then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled).toBe(false);

    release();
    await lending;
    const response = await borrowing;
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("NO_FREE_COPY");
  });
});

describe("Lend now on Book holds", () => {
  const terms = {
    dueOn: shiftCafeDay(today, 21),
    note: "Spine creased",
    depositAmount: "500000",
    depositMethod: "cash",
  };

  function lendNow(id: string, body: unknown = terms): Promise<Response> {
    return lendHold(jsonRequest("POST", `/api/admin/book-waitlist/${id}/lend`, body), routeParams({ id }));
  }

  it("lends the held book to its guest for the length chosen, with the deposit held on the books", async () => {
    const hold = await readJson<BookWaitlistEntry>(await borrowAs("customer"));

    signInAs("staff");
    const response = await lendNow(hold.id);
    expect(response.status).toBe(201);
    const loan = await readJson<BookLoan>(response);
    expect(loan).toMatchObject({
      productId: BLIND_OWL,
      userId: GUEST.id,
      borrowerName: GUEST.name,
      borrowerPhone: GUEST.phone,
      status: "out",
      note: "Spine creased",
      depositAmount: 500000,
      depositMethod: "cash",
      depositState: "held",
      lentById: TEST_USERS.staff.id,
    });
    expect(cafeDayOf(new Date(loan.dueAt))).toBe(shiftCafeDay(today, 21));

    // The hold is done, the loan is logged, and the deposit is money held, not income.
    expect(await line()).toEqual([]);
    expect((await line("?view=closed")).find((entry) => entry.id === hold.id)?.status).toBe("fulfilled");
    expect(await prisma.activityEntry.count({ where: { action: "bookLoan.lent", entityId: loan.id } })).toBe(1);
    expect(await balanceOf("1110")).toBe(500000);
    expect(await balanceOf("2400")).toBe(-500000);

    // The guest sees it on their loans page.
    signInAs("customer");
    const mine = await readJson<BookLoan[]>(await myLoans());
    expect(mine.map((own) => own.id)).toEqual([loan.id]);
  });

  it("lends without a deposit, and asks how one was paid", async () => {
    const hold = await readJson<BookWaitlistEntry>(await borrowAs("customer"));
    signInAs("staff");

    const unpaid = await lendNow(hold.id, { ...terms, depositMethod: undefined });
    expect(unpaid.status).toBe(400);
    expect((await readError(unpaid)).fieldErrors).toMatchObject({ depositMethod: "paymentInvalid" });

    const plain = await lendNow(hold.id, { dueOn: shiftCafeDay(today, 7) });
    expect(plain.status).toBe(201);
    const loan = await readJson<BookLoan>(plain);
    expect(loan.depositAmount).toBe(0);
    expect(loan).not.toHaveProperty("depositState");
    expect(await prisma.journalEntry.count({ where: { source: "loanDeposit" } })).toBe(0);
  });

  it("refuses a hold that isn't ready to collect, one that's gone, and a guest's own request", async () => {
    expect((await lendTo("Niloofar", "09121110005")).status).toBe(201);
    signInAs("customer");
    const waiting = await readJson<BookWaitlistEntry>(
      await joinLine(jsonRequest("POST", `/api/products/${BLIND_OWL}/waitlist`), routeParams({ id: BLIND_OWL })),
    );

    expect((await lendNow(waiting.id)).status).toBe(401);
    signInAs("staff");
    const notReady = await lendNow(waiting.id);
    expect(notReady.status).toBe(409);
    expect((await readError(notReady)).code).toBe("HOLD_NOT_READY");
    expect((await lendNow("no-such-hold")).status).toBe(404);
  });
});
