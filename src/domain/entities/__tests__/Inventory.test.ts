import { describe, expect, it } from "vitest";

import {
  consumptionFor,
  countEntry,
  issueStock,
  openingStockEntry,
  receiveStock,
  stockLevel,
  wasteEntry,
} from "../Inventory";
import { assertBalanced } from "../Ledger";
import { yearCloseEntry } from "../Postings";

const ACTOR = { id: "owner", name: "Rira" };

describe("perpetual inventory", () => {
  it("moves the average cost toward what was just paid", () => {
    // 1000 g at 1,800/g, then 1000 g at 2,000/g → 2000 g worth 3,800,000, 1,900/g.
    const first = receiveStock({ onHand: 0, value: 0, averageCost: 0 }, 1000, 1_800_000);
    const second = receiveStock(first, 1000, 2_000_000);
    expect(second).toEqual({ onHand: 2000, value: 3_800_000, averageCost: 1900 });
  });

  it("issues at average cost, and the last of the stock takes all its value", () => {
    const state = { onHand: 3, value: 100, averageCost: 100 / 3 };
    const some = issueStock(state, 1);
    expect(some.value).toBe(33);
    const rest = issueStock(some.state, 2);
    expect(rest.value).toBe(67);
    expect(rest.state).toMatchObject({ onHand: 0, value: 0 });
  });

  it("costs a sale per serving, so stock out equals unit cost × quantity exactly", () => {
    const stock = new Map([
      ["beans", { averageCost: 1900 }],
      ["milk", { averageCost: 70.4 }],
    ]);
    const used = consumptionFor(
      [
        { ingredientId: "beans", quantity: 18 },
        { ingredientId: "milk", quantity: 150 },
      ],
      3,
      stock,
    );
    expect(used.unitCost).toBe(34_200 + 10_560);
    expect(used.lines).toEqual([
      { ingredientId: "beans", quantity: 54, value: 102_600 },
      { ingredientId: "milk", quantity: 450, value: 31_680 },
    ]);
    expect(used.lines.reduce((sum, line) => sum + line.value, 0)).toBe(used.unitCost * 3);
  });

  it("reads out, low and ok from the reorder level", () => {
    expect(stockLevel({ onHand: 0, reorderLevel: 5 })).toBe("out");
    expect(stockLevel({ onHand: -2 })).toBe("out");
    expect(stockLevel({ onHand: 5, reorderLevel: 5 })).toBe("low");
    expect(stockLevel({ onHand: 6, reorderLevel: 5 })).toBe("ok");
    expect(stockLevel({ onHand: 1 })).toBe("ok");
  });
});

describe("inventory postings", () => {
  it("books waste, count shortages and surpluses, and opening stock against the right accounts", () => {
    const waste = assertBalanced(wasteEntry({ id: "w", date: "2026-10-16", value: 7000, description: "Milk" }, ACTOR));
    expect(waste.lines).toEqual([
      { accountCode: "5200", debit: 7000, credit: 0 },
      { accountCode: "1200", debit: 0, credit: 7000 },
    ]);
    const shortage = countEntry({ id: "c", date: "2026-10-16", variance: -5000, description: "Count" }, ACTOR);
    expect(shortage?.lines[0]).toMatchObject({ accountCode: "5300", debit: 5000 });
    const surplus = countEntry({ id: "c", date: "2026-10-16", variance: 3000, description: "Count" }, ACTOR);
    expect(surplus?.lines[0]).toMatchObject({ accountCode: "1200", debit: 3000 });
    expect(countEntry({ id: "c", date: "2026-10-16", variance: 0, description: "Count" }, ACTOR)).toBeNull();
    expect(
      openingStockEntry({ id: "o", date: "2026-10-16", value: 9000, description: "Opening" }, ACTOR).lines[1],
    ).toMatchObject({ accountCode: "3100", credit: 9000 });
  });

  it("closes a year's revenue and expenses into retained earnings", () => {
    const entry = yearCloseEntry(
      {
        fiscalYear: 1404,
        toDay: "2026-03-20",
        movements: [
          { accountCode: "4100", net: -10_000_000 }, // revenue (credit balance)
          { accountCode: "5100", net: 4_000_000 },
          { accountCode: "6100", net: 3_000_000 },
        ],
      },
      ACTOR,
    );
    const balanced = assertBalanced(entry ?? { lines: [] });
    expect(balanced.lines).toContainEqual({ accountCode: "4100", debit: 10_000_000, credit: 0 });
    expect(balanced.lines).toContainEqual({ accountCode: "3200", debit: 0, credit: 3_000_000 });
    expect(entry?.uniqueKey).toBe("yearClose:1404");
    expect(yearCloseEntry({ fiscalYear: 1404, toDay: "2026-03-20", movements: [] }, ACTOR)).toBeNull();
  });
});
