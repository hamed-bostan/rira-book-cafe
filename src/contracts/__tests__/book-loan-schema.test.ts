import { describe, expect, it } from "vitest";

import { MAX_BORROWER_NAME_LENGTH, MAX_LOAN_NOTE_LENGTH } from "@/src/domain/entities/BookLoan";

import { bookLoanUpdateSchema, lendBookSchema, type LendBookInput } from "../book-loan-schema";

import { messagesAt, flattened } from "./zod-issues";

const LOAN: LendBookInput = {
  productId: "book-1",
  borrowerName: " Sara Ahmadi ",
  borrowerPhone: " +98 912 345 6789 ",
  dueOn: "2026-10-31",
};

describe("lendBookSchema", () => {
  it("trims the borrower and leaves an absent note undefined", () => {
    expect(lendBookSchema.parse(LOAN)).toEqual({
      productId: "book-1",
      borrowerName: "Sara Ahmadi",
      borrowerPhone: "+98 912 345 6789",
      dueOn: "2026-10-31",
      note: undefined,
    });
  });

  it("trims a note and turns a blank one into undefined", () => {
    expect(lendBookSchema.parse({ ...LOAN, note: " Careful with the spine " }).note).toBe("Careful with the spine");
    expect(lendBookSchema.parse({ ...LOAN, note: "   " }).note).toBeUndefined();
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = flattened(
      lendBookSchema.safeParse({
        productId: "",
        borrowerName: " ",
        borrowerPhone: "123",
        dueOn: "next week",
        note: "n".repeat(MAX_LOAN_NOTE_LENGTH + 1),
      }).error,
    )?.fieldErrors;
    expect(fieldErrors).toEqual({
      productId: ["bookRequired"],
      borrowerName: ["nameRequired"],
      borrowerPhone: ["phoneInvalid"],
      dueOn: ["dateInvalid"],
      note: ["noteTooLong"],
    });
  });

  it("caps the borrower's name", () => {
    const result = lendBookSchema.safeParse({ ...LOAN, borrowerName: "n".repeat(MAX_BORROWER_NAME_LENGTH + 1) });
    expect(flattened(result.error)?.fieldErrors.borrowerName).toEqual(["nameTooLong"]);
  });
});

describe("bookLoanUpdateSchema", () => {
  it("accepts a known status and refuses others", () => {
    expect(bookLoanUpdateSchema.parse({ status: "returned" })).toEqual({ status: "returned" });
    expect(flattened(bookLoanUpdateSchema.safeParse({ status: "stolen" }).error)?.fieldErrors.status).toEqual([
      "statusInvalid",
    ]);
  });

  it("takes back an extension with two ISO instants, one change at a time", () => {
    const undoExtend = { dueAt: "2026-10-30T20:29:59.999Z", extendedDueAt: "2026-11-06T20:29:59.999Z" };
    expect(bookLoanUpdateSchema.parse({ undoExtend })).toEqual({ undoExtend });
    expect(
      messagesAt(
        bookLoanUpdateSchema.safeParse({ undoExtend: { ...undoExtend, dueAt: "2026-10-30" } }),
        "undoExtend.dueAt",
      ),
    ).toEqual(["dateInvalid"]);
    for (const body of [{}, { undoExtend, extendDays: 7 }, { undoExtend, status: "returned" }]) {
      expect(flattened(bookLoanUpdateSchema.safeParse(body).error)?.formErrors).toEqual(["nothingToChange"]);
    }
  });
});
