"use client";

import * as React from "react";

import type { LendHoldInput } from "@/src/contracts/book-loan-schema";
import type { LoanDepositMethod } from "@/src/domain/entities/BookLoan";
import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";

/** The loan lengths the desk offers, in days. */
export const LOAN_LENGTHS = ["7", "14", "21"] as const;
export type LoanLength = (typeof LOAN_LENGTHS)[number];
const DEFAULT_LENGTH: LoanLength = "14";

/** The terms' fields as the API names them, for mapping its `fieldErrors` back. */
export const LOAN_TERMS_FIELDS = ["dueOn", "note", "depositAmount", "depositMethod"] as const;

export type LoanTermsState = {
  length: LoanLength;
  setLength: (length: LoanLength) => void;
  note: string;
  setNote: (note: string) => void;
  /** As typed — Persian digits and separators allowed. */
  depositAmount: string;
  setDepositAmount: (amount: string) => void;
  depositMethod: LoanDepositMethod;
  setDepositMethod: (method: LoanDepositMethod) => void;
  /** The cafe day the book is due back: `length` days from today. */
  dueOn: string;
  /** Back to a fresh form: the standard length, no deposit, no note. */
  reset: () => void;
  /** The terms as the API takes them; the method only with a deposit. */
  values: () => LendHoldInput;
};

/**
 * How a book goes out — how long for, any deposit and how it was paid, and a note
 * — as both lending dialogs take it: "Lend a book" on Book loans and "Lend now" on
 * Book holds. Drawn by `LoanTermsFields`.
 */
export function useLoanTerms(today: string): LoanTermsState {
  const [length, setLength] = React.useState<LoanLength>(DEFAULT_LENGTH);
  const [note, setNote] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("");
  const [depositMethod, setDepositMethod] = React.useState<LoanDepositMethod>("cash");
  const dueOn = shiftCafeDay(today, Number(length));

  function reset(): void {
    setLength(DEFAULT_LENGTH);
    setNote("");
    setDepositAmount("");
    setDepositMethod("cash");
  }

  function values(): LendHoldInput {
    const deposit = normalizeAmount(depositAmount);
    return { dueOn, note, depositAmount: deposit, depositMethod: deposit ? depositMethod : undefined };
  }

  return {
    length,
    setLength,
    note,
    setNote,
    depositAmount,
    setDepositAmount,
    depositMethod,
    setDepositMethod,
    dueOn,
    reset,
    values,
  };
}
