import { describe, expect, it } from "vitest";

import { MAX_DRAWER_AMOUNT, MAX_SHIFT_NOTE_LENGTH } from "@/src/domain/entities/CashShift";

import { closeCashShiftSchema, openCashShiftSchema } from "../cash-shift-schema";

import { flattened } from "./zod-issues";

describe("openCashShiftSchema", () => {
  it("trims the note and turns blank or absent into undefined", () => {
    expect(openCashShiftSchema.parse({ openingFloat: 500000, note: " Float from the safe " })).toEqual({
      openingFloat: 500000,
      note: "Float from the safe",
    });
    expect(openCashShiftSchema.parse({ openingFloat: 0, note: "  " }).note).toBeUndefined();
    expect(openCashShiftSchema.parse({ openingFloat: MAX_DRAWER_AMOUNT })).toEqual({
      openingFloat: MAX_DRAWER_AMOUNT,
      note: undefined,
    });
  });

  it("maps each bad amount to its message key", () => {
    const messages = (openingFloat: number): string[] | undefined =>
      flattened(openCashShiftSchema.safeParse({ openingFloat }).error)?.fieldErrors.openingFloat;
    expect(messages(1.5)).toEqual(["amountWhole"]);
    expect(messages(-1)).toEqual(["amountInvalid"]);
    expect(messages(MAX_DRAWER_AMOUNT + 1)).toEqual(["amountTooLarge"]);
  });

  it("caps the note", () => {
    const result = openCashShiftSchema.safeParse({ openingFloat: 0, note: "n".repeat(MAX_SHIFT_NOTE_LENGTH + 1) });
    expect(flattened(result.error)?.fieldErrors.note).toEqual(["noteTooLong"]);
  });
});

describe("closeCashShiftSchema", () => {
  it("takes the counted cash", () => {
    expect(closeCashShiftSchema.parse({ countedCash: 0, note: "" })).toEqual({ countedCash: 0, note: undefined });
    expect(flattened(closeCashShiftSchema.safeParse({ countedCash: -5 }).error)?.fieldErrors.countedCash).toEqual([
      "amountInvalid",
    ]);
  });
});
