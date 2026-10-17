import { describe, expect, it } from "vitest";

import { MAX_BORROWER_NAME_LENGTH, MAX_LOAN_NOTE_LENGTH } from "@/src/domain/entities/BookLoan";

import { bookLoanUpdateSchema, lendBookSchema, type LendBookInput } from "../book-loan-schema";

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
    const fieldErrors = lendBookSchema.safeParse({
      productId: "",
      borrowerName: " ",
      borrowerPhone: "123",
      dueOn: "next week",
      note: "n".repeat(MAX_LOAN_NOTE_LENGTH + 1),
    }).error?.flatten().fieldErrors;
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
    expect(result.error?.flatten().fieldErrors.borrowerName).toEqual(["nameTooLong"]);
  });
});

describe("bookLoanUpdateSchema", () => {
  it("accepts a known status and refuses others", () => {
    expect(bookLoanUpdateSchema.parse({ status: "returned" })).toEqual({ status: "returned" });
    expect(bookLoanUpdateSchema.safeParse({ status: "stolen" }).error?.flatten().fieldErrors.status).toEqual(["statusInvalid"]);
  });
});
