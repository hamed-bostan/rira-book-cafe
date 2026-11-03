import { describe, expect, it } from "vitest";

import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { GET as countLoans } from "@/app/api/admin/book-loans/counts/route";
import { POST as lend } from "@/app/api/admin/book-loans/route";
import { DELETE as removeHold } from "@/app/api/admin/book-waitlist/[id]/route";
import { GET as listHolds, POST as addHold } from "@/app/api/admin/book-waitlist/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { BookLoanCounts } from "@/src/domain/repositories/IBookLoanRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { lockBookShelf } from "@/src/infrastructure/repositories/bookShelf";
import { PrismaBookWaitlistRepository } from "@/src/infrastructure/repositories/PrismaBookWaitlistRepository";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const BLIND_OWL = "seed-book-blind-owl";
const SAVUSHUN = "seed-book-savushun";
const dueOn = shiftCafeDay(cafeDayOf(new Date()), 14);

function lendTo(productId: string, name: string, phone: string): Promise<Response> {
  return lend(
    jsonRequest("POST", "/api/admin/book-loans", {
      productId,
      borrowerName: name,
      borrowerPhone: phone,
      dueOn,
      note: "",
    }),
  );
}

function hold(productId: string, name: string, phone: string): Promise<Response> {
  return addHold(jsonRequest("POST", "/api/admin/book-waitlist", { productId, guestName: name, guestPhone: phone }));
}

async function openLine(productId: string): Promise<BookWaitlistEntry[]> {
  const entries = await readJson<BookWaitlistEntry[]>(await listHolds(getRequest("/api/admin/book-waitlist")));
  return entries.filter((entry) => entry.productId === productId);
}

describe("book copies and holds", () => {
  it("counts every loan in each view", async () => {
    signInAs("admin");
    const before = await readJson<BookLoanCounts>(await countLoans());
    expect((await lendTo(SAVUSHUN, "Shirin", "09121110009")).status).toBe(201);

    const after = await readJson<BookLoanCounts>(await countLoans());
    expect(after).toEqual({ ...before, open: before.open + 1, all: before.all + 1 });
  });

  it("refuses a loan once every copy is out", async () => {
    signInAs("admin");
    expect((await lendTo(BLIND_OWL, "Niloofar", "09121110005")).status).toBe(201);

    const second = await lendTo(BLIND_OWL, "Sara", "09301184462");
    expect(second.status).toBe(409);
    expect((await readError(second)).code).toBe("ALL_COPIES_OUT");
  });

  it("only holds a book that's out, once per phone, for guests without an account", async () => {
    signInAs("admin");
    const onShelf = await hold(SAVUSHUN, "Ali", "09121110004");
    expect(onShelf.status).toBe(409);
    expect((await readError(onShelf)).code).toBe("BOOK_ON_SHELF");

    await lendTo(BLIND_OWL, "Niloofar", "09121110005");
    const added = await hold(BLIND_OWL, "Sara Ahmadi", "0935 111 2233");
    expect(added.status).toBe(201);
    const entry = await readJson<BookWaitlistEntry>(added);
    expect(entry).toMatchObject({ status: "waiting", guestPhone: "09351112233" });
    expect(entry).not.toHaveProperty("userId");

    const again = await hold(BLIND_OWL, "Sara", "09351112233");
    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("ALREADY_WAITING");
  });

  it("tells the first in line when the book comes back, and the next when they're skipped", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    const first = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Sara", "09351112233"));
    const second = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Hamid", "09124041180"));

    await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned" }),
      routeParams({ id: loan.id }),
    );
    expect((await openLine(BLIND_OWL)).map((e) => [e.id, e.status])).toEqual([
      [first.id, "notified"],
      [second.id, "waiting"],
    ]);

    const skipped = await removeHold(getRequest(`/api/admin/book-waitlist/${first.id}`), routeParams({ id: first.id }));
    expect(skipped.status).toBe(204);
    expect((await openLine(BLIND_OWL)).map((e) => [e.id, e.status])).toEqual([[second.id, "notified"]]);

    const closed = await readJson<BookWaitlistEntry[]>(
      await listHolds(getRequest("/api/admin/book-waitlist?view=closed")),
    );
    expect(closed.find((e) => e.id === first.id)?.status).toBe("cancelled");
  });

  it("skips the told guest when their copy is lent to someone else, and logs it", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    const told = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Sara", "09351112233"));
    const next = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Hamid", "09124041180"));
    await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned" }),
      routeParams({ id: loan.id }),
    );

    expect((await lendTo(BLIND_OWL, "Reza", "09121110006")).status).toBe(201);
    // Nobody new is told: the copy that was held is out again.
    expect((await openLine(BLIND_OWL)).map((e) => [e.id, e.status])).toEqual([[next.id, "waiting"]]);
    const closed = await readJson<BookWaitlistEntry[]>(
      await listHolds(getRequest("/api/admin/book-waitlist?view=closed")),
    );
    expect(closed.find((e) => e.id === told.id)?.status).toBe("cancelled");
    const entry = await prisma.activityEntry.findFirstOrThrow({ where: { action: "bookLoan.holdSkipped" } });
    expect(entry).toMatchObject({ entityType: "bookLoan", entityId: told.id, entityLabel: "Sara (The Blind Owl)" });
  });

  it("fulfils the told guest's hold when the copy is lent to them, by phone however it's typed", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    const told = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Sara", "09351112233"));
    const next = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Hamid", "09124041180"));
    await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned" }),
      routeParams({ id: loan.id }),
    );

    expect((await lendTo(BLIND_OWL, "Sara Ahmadi", "+98 935 111 2233")).status).toBe(201);
    expect((await openLine(BLIND_OWL)).map((e) => [e.id, e.status])).toEqual([[next.id, "waiting"]]);
    const closed = await readJson<BookWaitlistEntry[]>(
      await listHolds(getRequest("/api/admin/book-waitlist?view=closed")),
    );
    expect(closed.find((e) => e.id === told.id)?.status).toBe("fulfilled");
    expect(await prisma.activityEntry.count({ where: { action: "bookLoan.holdSkipped" } })).toBe(0);
  });

  it("leaves told guests alone while a copy is free beyond theirs", async () => {
    signInAs("admin");
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 2 } });
    const first = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    await lendTo(BLIND_OWL, "Parisa", "09121110007");
    const told = await readJson<BookWaitlistEntry>(await hold(BLIND_OWL, "Sara", "09351112233"));
    await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${first.id}`, { status: "returned" }),
      routeParams({ id: first.id }),
    );
    // One copy back and held for Sara, and a third bought: lending that one leaves hers.
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 3 } });

    expect((await lendTo(BLIND_OWL, "Reza", "09121110006")).status).toBe(201);
    expect((await openLine(BLIND_OWL)).map((e) => [e.id, e.status])).toEqual([[told.id, "notified"]]);
  });

  it("tells the next guest only once lending has let go of the book", async () => {
    signInAs("admin");
    await lendTo(BLIND_OWL, "Niloofar", "09121110005");
    await hold(BLIND_OWL, "Sara", "09351112233");

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
      },
      { timeout: 10_000 },
    );
    await lockTaken;

    let told = false;
    const telling = new PrismaBookWaitlistRepository().notifyNext(BLIND_OWL, new Date()).then(() => {
      told = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(told).toBe(false);

    release();
    await lending;
    await telling;
    expect(told).toBe(true);
  });

  it("extends a loan that's out by seven days, and only that", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(SAVUSHUN, "Parisa", "09121110007"));

    const extended = await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { extendDays: 7 }),
      routeParams({ id: loan.id }),
    );
    expect(extended.status).toBe(200);
    expect(new Date((await readJson<BookLoan>(extended)).dueAt).getTime() - new Date(loan.dueAt).getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );

    const both = await changeLoan(
      jsonRequest("PATCH", `/api/admin/book-loans/${loan.id}`, { status: "returned", extendDays: 7 }),
      routeParams({ id: loan.id }),
    );
    expect(both.status).toBe(400);
  });
});
