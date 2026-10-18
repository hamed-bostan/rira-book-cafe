import { describe, expect, it } from "vitest";

import {
  openingStockSchema,
  reorderLevelSchema,
  stockCountSchema,
  stockReceiptSchema,
  wasteSchema,
  yearCloseSchema,
  type StockReceiptFormInput,
} from "../inventory-schema";

import { messagesAt } from "./zod-issues";

type PricedLine = StockReceiptFormInput["lines"][number];

const BEANS: PricedLine = { ingredientId: "ing-beans", quantity: "1000", cost: "2400000" };
const SYRUP: PricedLine = { ingredientId: "ing-syrup", quantity: "0.5", cost: "" };

const RECEIPT: StockReceiptFormInput = {
  date: "2026-10-17",
  supplierId: "",
  description: " Beans delivery ",
  lines: [BEANS, SYRUP],
  vatAmount: "",
  payment: "bank",
};

const lines = (count: number): PricedLine[] =>
  Array.from({ length: count }, (_, index) => ({ ...BEANS, ingredientId: `ing-${index}` }));

describe("stockReceiptSchema", () => {
  it("parses lines and turns the payment choice into a paying source", () => {
    const parsed = stockReceiptSchema.parse(RECEIPT);
    expect(parsed).toEqual({
      date: "2026-10-17",
      supplierId: undefined,
      description: "Beans delivery",
      lines: [
        { ingredientId: "ing-beans", quantity: 1000, cost: 2400000 },
        { ingredientId: "ing-syrup", quantity: 0.5, cost: 0 },
      ],
      vatAmount: 0,
      paidFrom: "bank",
    });
    expect(parsed).not.toHaveProperty("payment");
  });

  it("keeps a supplier and an unpaid delivery on account", () => {
    expect(
      stockReceiptSchema.parse({ ...RECEIPT, supplierId: " sup-1 ", vatAmount: "216000", payment: "unpaid" }),
    ).toMatchObject({
      supplierId: "sup-1",
      vatAmount: 216000,
      paidFrom: undefined,
    });
  });

  it("needs some line to cost something", () => {
    const result = stockReceiptSchema.safeParse({ ...RECEIPT, lines: [{ ...BEANS, cost: "" }, SYRUP] });
    expect(messagesAt(result, "lines")).toEqual(["deliveryTotalRequired"]);
  });

  it("bounds the number of lines", () => {
    expect(messagesAt(stockReceiptSchema.safeParse({ ...RECEIPT, lines: [] }), "lines")).toContain("linesTooFew");
    expect(stockReceiptSchema.safeParse({ ...RECEIPT, lines: lines(200) }).success).toBe(true);
    expect(messagesAt(stockReceiptSchema.safeParse({ ...RECEIPT, lines: lines(201) }), "lines")).toEqual([
      "linesTooMany",
    ]);
  });

  it("maps each invalid field to its message key", () => {
    const result = stockReceiptSchema.safeParse({
      ...RECEIPT,
      description: " ",
      lines: [{ ingredientId: " ", quantity: "0", cost: "x" }],
      payment: "card",
    });
    expect(messagesAt(result, "description")).toEqual(["descriptionRequired"]);
    expect(messagesAt(result, "lines.0.ingredientId")).toEqual(["ingredientRequired"]);
    expect(messagesAt(result, "lines.0.quantity")).toEqual(["quantityInvalid"]);
    expect(messagesAt(result, "lines.0.cost")).toEqual(["amountInvalid"]);
    expect(messagesAt(result, "payment")).toEqual(["paymentInvalid"]);
  });
});

describe("wasteSchema", () => {
  it("parses a decimal quantity and blanks the note", () => {
    expect(wasteSchema.parse({ date: "2026-10-17", ingredientId: "ing-milk", quantity: "0.25", note: "" })).toEqual({
      date: "2026-10-17",
      ingredientId: "ing-milk",
      quantity: 0.25,
      note: undefined,
    });
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = wasteSchema
      .safeParse({ date: "", ingredientId: " ", quantity: "-1", note: "n".repeat(201) })
      .error?.flatten().fieldErrors;
    expect(fieldErrors?.date).toContain("dateRequired");
    expect(fieldErrors?.ingredientId).toEqual(["ingredientRequired"]);
    expect(fieldErrors?.quantity).toEqual(["quantityInvalid"]);
    expect(fieldErrors?.note).toEqual(["textTooLong"]);
  });
});

describe("stockCountSchema", () => {
  it("accepts zero counts and trims the note", () => {
    const parsed = stockCountSchema.parse({
      date: "2026-10-17",
      lines: [
        { ingredientId: "ing-beans", counted: "0" },
        { ingredientId: "ing-milk", counted: "12.5" },
      ],
      note: " Monthly count ",
    });
    expect(parsed.lines.map((line) => line.counted)).toEqual([0, 12.5]);
    expect(parsed.note).toBe("Monthly count");
  });

  it("refuses counting the same item twice", () => {
    const result = stockCountSchema.safeParse({
      date: "2026-10-17",
      lines: [
        { ingredientId: "ing-beans", counted: "1" },
        { ingredientId: "ing-beans", counted: "2" },
      ],
      note: "",
    });
    expect(messagesAt(result, "lines")).toEqual(["ingredientRepeated"]);
  });

  it("needs a line, each with a numeric count", () => {
    expect(messagesAt(stockCountSchema.safeParse({ date: "2026-10-17", lines: [], note: "" }), "lines")).toEqual([
      "linesTooFew",
    ]);
    const result = stockCountSchema.safeParse({
      date: "2026-10-17",
      lines: [{ ingredientId: "ing-beans", counted: "lots" }],
      note: "",
    });
    expect(messagesAt(result, "lines.0.counted")).toEqual(["quantityInvalid"]);
  });
});

describe("openingStockSchema", () => {
  it("allows lines with no cost", () => {
    expect(openingStockSchema.parse({ date: "2026-03-21", lines: [SYRUP] }).lines).toEqual([
      { ingredientId: "ing-syrup", quantity: 0.5, cost: 0 },
    ]);
  });

  it("needs at least one line", () => {
    expect(openingStockSchema.safeParse({ date: "2026-03-21", lines: [] }).error?.flatten().fieldErrors.lines).toEqual([
      "linesTooFew",
    ]);
  });
});

describe("reorderLevelSchema", () => {
  it("reads blank as cleared and a number as the level", () => {
    expect(reorderLevelSchema.parse({ reorderLevel: " " })).toEqual({ reorderLevel: null });
    expect(reorderLevelSchema.parse({ reorderLevel: " 5 " })).toEqual({ reorderLevel: 5 });
    expect(reorderLevelSchema.parse({ reorderLevel: "0" })).toEqual({ reorderLevel: 0 });
  });

  it("refuses a negative level", () => {
    expect(reorderLevelSchema.safeParse({ reorderLevel: "-1" }).error?.flatten().fieldErrors.reorderLevel).toEqual([
      "quantityInvalid",
    ]);
  });
});

describe("yearCloseSchema", () => {
  it("takes a whole Persian year in range", () => {
    expect(yearCloseSchema.parse({ year: 1404 })).toEqual({ year: 1404 });
    for (const year of [1299, 1601, 1404.5]) {
      expect(yearCloseSchema.safeParse({ year }).success).toBe(false);
    }
  });
});
