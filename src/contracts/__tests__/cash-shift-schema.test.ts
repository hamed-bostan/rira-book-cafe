import { describe, expect, it } from "vitest";

import { MAX_DRAWER_AMOUNT, MAX_SHIFT_NOTE_LENGTH } from "@/src/domain/entities/CashShift";

import { closeCashShiftSchema, openCashShiftSchema } from "../cash-shift-schema";

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
      openCashShiftSchema.safeParse({ openingFloat }).error?.flatten().fieldErrors.openingFloat;
    expect(messages(1.5)).toEqual(["amountWhole"]);
    expect(messages(-1)).toEqual(["amountInvalid"]);
    expect(messages(MAX_DRAWER_AMOUNT + 1)).toEqual(["amountTooLarge"]);
  });

  it("caps the note", () => {
    const result = openCashShiftSchema.safeParse({ openingFloat: 0, note: "n".repeat(MAX_SHIFT_NOTE_LENGTH + 1) });
    expect(result.error?.flatten().fieldErrors.note).toEqual(["noteTooLong"]);
  });
});

describe("closeCashShiftSchema", () => {
  it("takes the counted cash", () => {
    expect(closeCashShiftSchema.parse({ countedCash: 0, note: "" })).toEqual({ countedCash: 0, note: undefined });
    expect(closeCashShiftSchema.safeParse({ countedCash: -5 }).error?.flatten().fieldErrors.countedCash).toEqual([
      "amountInvalid",
    ]);
  });
});
