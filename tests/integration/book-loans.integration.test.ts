import { describe, expect, it } from "vitest";

import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { GET as listBooks } from "@/app/api/admin/book-loans/books/route";
import { POST as lend } from "@/app/api/admin/book-loans/route";
import { GET as listHolds, POST as addHold } from "@/app/api/admin/book-waitlist/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** One copy on the lending shelf (no count set). */
const BLIND_OWL = "seed-book-blind-owl";
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

function setStatus(id: string, status: "returned" | "lost"): Promise<Response> {
  return changeLoan(jsonRequest("PATCH", `/api/admin/book-loans/${id}`, { status }), routeParams({ id }));
}

async function book(productId: string): Promise<LendableBook | undefined> {
  return (await readJson<LendableBook[]>(await listBooks())).find((candidate) => candidate.id === productId);
}

describe("a lost copy", () => {
  it("comes off the shelf, so the book can't be lent until it turns up", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    expect((await setStatus(loan.id, "lost")).status).toBe(200);

    expect(await book(BLIND_OWL)).toMatchObject({ copies: 0, onLoan: 0 });
    const refused = await lendTo(BLIND_OWL, "Sara", "09351112233");
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("ALL_COPIES_OUT");

    const entry = await prisma.activityEntry.findFirstOrThrow({
      where: { action: "bookLoan.lost", entityId: loan.id },
    });
    expect(entry.changes).toEqual([
      { field: "status", before: "out", after: "lost" },
      { field: "bookCopies", before: "1", after: "0" },
    ]);
  });

  it("goes back on the shelf when it turns up, and the next guest in line is told", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    await setStatus(loan.id, "lost");
    const waiting = await addHold(
      jsonRequest("POST", "/api/admin/book-waitlist", {
        productId: BLIND_OWL,
        guestName: "Sara",
        guestPhone: "09351112233",
      }),
    );
    expect(waiting.status).toBe(201);

    expect((await setStatus(loan.id, "returned")).status).toBe(200);
    expect(await book(BLIND_OWL)).toMatchObject({ copies: 1, onLoan: 0 });
    const line = await readJson<BookWaitlistEntry[]>(await listHolds(getRequest("/api/admin/book-waitlist")));
    expect(line.filter((entry) => entry.productId === BLIND_OWL).map((entry) => entry.status)).toEqual(["notified"]);

    const entry = await prisma.activityEntry.findFirstOrThrow({
      where: { action: "bookLoan.returned", entityId: loan.id },
    });
    expect(entry.changes).toEqual([
      { field: "status", before: "lost", after: "returned" },
      { field: "bookCopies", before: "0", after: "1" },
    ]);
  });

  it("leaves the copies alone when a book simply comes back", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    await setStatus(loan.id, "returned");
    expect(await book(BLIND_OWL)).toMatchObject({ copies: 1, onLoan: 0 });
  });
});
