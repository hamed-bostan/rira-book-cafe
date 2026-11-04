import { describe, expect, it, vi } from "vitest";

import { AdjustStock, ReceiveStock, ReturnToSupplier, stockChangeAudit } from "../InventoryCommands";

import type { Expense } from "../../../entities/Expense";
import type { StockItem, StockMovement, SupplierReturn } from "../../../entities/Inventory";
import type { IInventoryRepository } from "../../../repositories/IInventoryRepository";

const ACTOR = { id: "a1", name: "Owner" };
const NOW = new Date("2026-10-20T10:00:00Z");

const BEANS: StockItem = {
  id: "beans",
  name: "Beans",
  unit: "g",
  onHand: 0,
  averageCost: 0,
  value: 0,
  purchaseUnits: [{ name: "bag", factor: 1000 }],
  lastPurchaseCost: 0,
  isActive: true,
  level: "out",
  hasHistory: false,
};

describe("ReceiveStock with packs", () => {
  it("brings a pack line into base units, costed per pack", async () => {
    const receive = vi.fn<IInventoryRepository["receive"]>(async () => ({}) as Expense);
    const listStock = vi.fn(async () => [BEANS]);
    await new ReceiveStock({ receive, listStock } as unknown as IInventoryRepository).execute(
      {
        date: "2026-10-20",
        description: "Beans",
        vatAmount: 0,
        lines: [{ ingredientId: "beans", quantity: 3, purchaseUnit: "bag", cost: 450_000, costPerUnit: true }],
      },
      ACTOR,
      NOW,
    );
    expect(receive.mock.calls[0][0].lines).toEqual([
      { ingredientId: "beans", quantity: 3000, cost: 1_350_000, note: "3 × bag" },
    ]);
  });

  it("refuses a pack the item isn't bought in", async () => {
    const receive = vi.fn();
    const listStock = vi.fn(async () => [BEANS]);
    await expect(
      new ReceiveStock({ receive, listStock } as unknown as IInventoryRepository).execute(
        {
          date: "2026-10-20",
          description: "Beans",
          vatAmount: 0,
          lines: [{ ingredientId: "beans", quantity: 1, purchaseUnit: "crate", cost: 1 }],
        },
        ACTOR,
        NOW,
      ),
    ).rejects.toMatchObject({ field: "lines.0.purchaseUnit" });
    expect(receive).not.toHaveBeenCalled();
  });
});

describe("AdjustStock", () => {
  const adjust = vi.fn<IInventoryRepository["adjust"]>(async () => ({}) as StockMovement);
  const useCase = new AdjustStock({ adjust } as unknown as IInventoryRepository);

  it("passes the reason on and books it to the reason's account", async () => {
    await useCase.execute({ date: "2026-10-20", ingredientId: "beans", quantity: -20, reason: "sampling" }, ACTOR, NOW);
    const [input, ledger] = adjust.mock.calls[0];
    expect(input).toMatchObject({ quantity: -20, reason: "sampling" });
    expect(ledger({ id: "x", date: "2026-10-20", value: -2000, description: "" })?.lines[0]).toMatchObject({
      accountCode: "6610",
      debit: 2000,
    });
  });

  it.each([
    [{ quantity: 5, reason: "damaged" as const }, "quantity"],
    [{ quantity: -5, reason: "other" as const }, "note"],
    [{ quantity: 0, reason: "correction" as const }, "quantity"],
    [{ quantity: 1, reason: "stolen" as never }, "reason"],
  ])("refuses %o", async (overrides, field) => {
    await expect(
      useCase.execute({ date: "2026-10-20", ingredientId: "beans", ...overrides }, ACTOR, NOW),
    ).rejects.toMatchObject({ field });
  });
});

describe("ReturnToSupplier", () => {
  it("builds the return's entry from what the repository settled", async () => {
    const returnToSupplier = vi.fn<IInventoryRepository["returnToSupplier"]>(async () => ({}) as SupplierReturn);
    await new ReturnToSupplier({ returnToSupplier } as unknown as IInventoryRepository).execute(
      {
        date: "2026-10-20",
        supplierId: "s1",
        lines: [{ ingredientId: "beans", quantity: 100 }],
        creditAmount: 50_000,
        vatAmount: 0,
      },
      ACTOR,
      NOW,
    );
    const ledger = returnToSupplier.mock.calls[0][1];
    const entry = ledger({
      id: "r1",
      number: 3,
      date: "2026-10-20",
      supplierName: "Roaster",
      applied: 20_000,
      refunded: 30_000,
      refundedTo: "cash",
      vatAmount: 0,
      stockValue: 50_000,
      expenseNumber: 9,
    });
    expect(entry).toMatchObject({ source: "supplierReturn", description: "SR-3 — returned to Roaster (EX-9)" });
  });

  it("refuses VAT above the credit and a repeated item", async () => {
    const returnToSupplier = vi.fn();
    const useCase = new ReturnToSupplier({ returnToSupplier } as unknown as IInventoryRepository);
    const base = { date: "2026-10-20", supplierId: "s1", lines: [{ ingredientId: "beans", quantity: 1 }] };
    await expect(useCase.execute({ ...base, creditAmount: 10, vatAmount: 20 }, ACTOR, NOW)).rejects.toMatchObject({
      field: "vatAmount",
    });
    await expect(
      useCase.execute({ ...base, lines: [...base.lines, ...base.lines], creditAmount: 0, vatAmount: 0 }, ACTOR, NOW),
    ).rejects.toMatchObject({ field: "lines" });
    expect(returnToSupplier).not.toHaveBeenCalled();
  });
});

describe("stockChangeAudit", () => {
  it("records on hand before and after, the value, and the reason", () => {
    const entry = stockChangeAudit(
      ACTOR,
      "stockItem.adjusted",
    )({
      ingredientId: "beans",
      ingredientName: "Beans",
      kind: "adjustment",
      quantity: -20,
      onHandBefore: 100,
      onHandAfter: 80,
      value: -2000,
      referenceId: "x",
      reason: "staffMeal",
    });
    expect(entry).toMatchObject({
      entityType: "stockItem",
      entityId: "beans",
      changes: [
        { field: "onHand", before: "100", after: "80" },
        { field: "value", before: null, after: "-2000" },
        { field: "reason", before: null, after: "staffMeal" },
      ],
    });
  });
});
