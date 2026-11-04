import { describe, expect, it } from "vitest";

import {
  adjustmentEntry,
  adjustmentFitsReason,
  onHandAtEndOf,
  orderList,
  settleSupplierCredit,
  suggestOrder,
  supplierReturnEntry,
  withRunningBalance,
  type StockItem,
} from "../Inventory";
import { assertBalanced, SYSTEM_ACCOUNTS } from "../Ledger";
import { costBasisOf, costingUnitCost, purchaseUnitsRefusal, recipeCost, toBaseQuantity } from "../Pricing";

const ACTOR = { id: "a1", name: "Owner" };

function item(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: "beans",
    name: "Beans",
    unit: "g",
    onHand: 400,
    averageCost: 1000,
    value: 400_000,
    reorderLevel: 500,
    purchaseUnits: [],
    lastPurchaseCost: 1200,
    isActive: true,
    level: "low",
    hasHistory: true,
    ...overrides,
  };
}

describe("purchase units", () => {
  it("convert a typed pack into base units", () => {
    expect(toBaseQuantity(3, "bag", [{ name: "bag", factor: 1000 }])).toBe(3000);
    expect(toBaseQuantity(2.5, "", [])).toBe(2.5);
    expect(toBaseQuantity(1, "sack", [{ name: "bag", factor: 1000 }])).toBeNull();
  });

  it("refuse blank, repeated, base-unit and zero-sized packs", () => {
    expect(purchaseUnitsRefusal([{ name: "bag", factor: 1000 }], "g")).toBeNull();
    expect(purchaseUnitsRefusal([{ name: "", factor: 1 }], "g")).toBe("NAME_INVALID");
    expect(purchaseUnitsRefusal([{ name: "g", factor: 1 }], "g")).toBe("NAME_INVALID");
    expect(purchaseUnitsRefusal([{ name: "bag", factor: 0 }], "g")).toBe("FACTOR_INVALID");
    expect(
      purchaseUnitsRefusal(
        [
          { name: "Bag", factor: 1 },
          { name: "bag", factor: 2 },
        ],
        "g",
      ),
    ).toBe("NAME_REPEATED");
  });
});

describe("recipe costing basis", () => {
  const syrup = { purchasePrice: 300_000, purchaseQuantity: 1000, onHand: 500, averageCost: 200 };

  it("reads average cost with stock on hand and the last price without", () => {
    expect(costBasisOf(syrup)).toBe("average");
    expect(costingUnitCost(syrup)).toBe(200);
    expect(costingUnitCost({ ...syrup, onHand: 0 })).toBe(300);
    expect(recipeCost([{ ingredientId: "s", quantity: 10 }], new Map([["s", syrup]]))).toBe(2000);
  });
});

describe("adjustments", () => {
  it("only move stock the way their reason allows", () => {
    expect(adjustmentFitsReason("found", 5)).toBe(true);
    expect(adjustmentFitsReason("found", -5)).toBe(false);
    expect(adjustmentFitsReason("staffMeal", -5)).toBe(true);
    expect(adjustmentFitsReason("staffMeal", 5)).toBe(false);
    expect(adjustmentFitsReason("correction", 5)).toBe(true);
    expect(adjustmentFitsReason("correction", 0)).toBe(false);
  });

  it("post to the reason's account, balanced", () => {
    const meal = adjustmentEntry(
      { id: "x", date: "2026-11-04", value: -1000, reason: "staffMeal", description: "" },
      ACTOR,
    );
    expect(meal?.lines).toEqual([
      { accountCode: "6410", debit: 1000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: 1000 },
    ]);
    const found = adjustmentEntry({ id: "y", date: "2026-11-04", value: 500, reason: "found", description: "" }, ACTOR);
    expect(found?.lines[1]).toEqual({ accountCode: "5300", debit: 0, credit: 500 });
    expect(
      adjustmentEntry({ id: "z", date: "2026-11-04", value: 0, reason: "other", description: "" }, ACTOR),
    ).toBeNull();
  });
});

describe("supplier returns", () => {
  it("settle a credit against what's owed first, the rest as money", () => {
    expect(settleSupplierCredit(300, 1000)).toEqual({ applied: 300, refunded: 0 });
    expect(settleSupplierCredit(300, 100)).toEqual({ applied: 100, refunded: 200 });
    expect(settleSupplierCredit(300, 0)).toEqual({ applied: 0, refunded: 300 });
  });

  it.each([
    [330_000, 0, 30_000, 250_000],
    [100_000, 50_000, 0, 200_000],
    [0, 0, 0, 40_000],
  ])("balance: applied %i, refunded %i, VAT %i, stock %i", (applied, refunded, vatAmount, stockValue) => {
    const entry = supplierReturnEntry(
      {
        id: "r",
        date: "2026-11-04",
        applied,
        refunded,
        refundedTo: "bank",
        vatAmount,
        stockValue,
        supplierName: "S",
        description: "",
      },
      ACTOR,
    );
    const balanced = assertBalanced(entry);
    const inventory = balanced.lines.find((line) => line.accountCode === SYSTEM_ACCOUNTS.inventory);
    expect(inventory?.credit ?? 0).toBe(stockValue);
  });
});

describe("running balance and backdated on hand", () => {
  it("walk back from the newest movement's balance", () => {
    const rows = withRunningBalance([{ quantity: 500 }, { quantity: -150 }, { quantity: 1000 }], 1350);
    expect(rows.map((row) => row.balanceAfter)).toEqual([1350, 850, 1000]);
  });

  it("take out what moved after the day", () => {
    expect(onHandAtEndOf(1500, 500)).toBe(1000);
  });
});

describe("the order list", () => {
  it("suggests par − on hand, rounded up to whole packs", () => {
    expect(suggestOrder(item({ parLevel: 2000 }))).toEqual({ quantity: 1600 });
    expect(suggestOrder(item({ parLevel: 2000, purchaseUnits: [{ name: "bag", factor: 1000 }] }))).toEqual({
      quantity: 2000,
      packs: { count: 2, unit: { name: "bag", factor: 1000 } },
    });
    expect(suggestOrder(item({ parLevel: 300 }))).toEqual({ quantity: 0 });
    expect(suggestOrder(item())).toBeNull();
    // Below zero counts as nothing on hand.
    expect(suggestOrder(item({ onHand: -50, parLevel: 1000 }))).toEqual({ quantity: 1000 });
  });

  it("groups what needs ordering by supplier, the unassigned last", () => {
    const groups = orderList([
      item({ id: "a", name: "Milk", supplierId: "s2", supplierName: "Dairy" }),
      item({ id: "b", name: "Beans", supplierId: "s1", supplierName: "Roaster" }),
      item({ id: "c", name: "Cups" }),
      item({ id: "d", name: "Tea", level: "ok" }),
      item({ id: "e", name: "Oats", isActive: false }),
    ]);
    expect(groups.map((group) => group.supplierName ?? "-")).toEqual(["Dairy", "Roaster", "-"]);
    expect(groups.flatMap((group) => group.lines.map((line) => line.item.id))).toEqual(["a", "b", "c"]);
  });
});
