import { describe, expect, it, vi } from "vitest";

import { INVENTORY_ACCOUNTS } from "../../../entities/Inventory";
import { SYSTEM_ACCOUNTS } from "../../../entities/Ledger";
import { ValidationError } from "../../../errors/ValidationError";
import {
  CountStock,
  GetInventory,
  MAX_STOCK_LINES,
  ReceiveStock,
  RecordOpeningStock,
  RecordWaste,
  SetReorderLevel,
} from "../InventoryCommands";

import type { Expense } from "../../../entities/Expense";
import type { StockItem, StockMovement } from "../../../entities/Inventory";
import type { IInventoryRepository, StockEvent, StockReceiptInput } from "../../../repositories/IInventoryRepository";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "a1", name: "Barista" };
/** 13:30 in Tehran on 2026-10-20 — that's "today" for every date check below. */
const NOW = new Date("2026-10-20T10:00:00Z");
const SETTINGS = { vatRateBps: 1000 };

function item(overrides: Partial<StockItem> = {}): StockItem {
  return { id: "milk", name: "Milk", unit: "ml", onHand: 1000, averageCost: 50, value: 50_000, isActive: true, level: "ok", ...overrides };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "x1",
    number: 7,
    date: "2026-10-20",
    accountCode: SYSTEM_ACCOUNTS.inventory,
    description: "Milk delivery",
    amount: 110_000,
    vatAmount: 10_000,
    status: "unpaid",
    createdById: ACTOR.id,
    createdByName: ACTOR.name,
    createdAt: "",
    ...overrides,
  };
}

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: "m1",
    ingredientId: "milk",
    ingredientName: "Milk",
    kind: "waste",
    quantity: -200,
    value: -10_000,
    date: "2026-10-20",
    createdByName: ACTOR.name,
    createdAt: "",
    ...overrides,
  };
}

const EVENT: StockEvent = { id: "ev1", date: "2026-10-20", value: 10_000, description: "Spilled milk" };

describe("GetInventory", () => {
  function setup(items: StockItem[], inventoryDebit: number, inventoryCredit: number): GetInventory {
    const inventory = { listStock: vi.fn(async () => items) } as unknown as IInventoryRepository;
    const ledger = {
      movements: vi.fn(async () => [
        { accountCode: SYSTEM_ACCOUNTS.cash, debit: 999, credit: 0 },
        { accountCode: SYSTEM_ACCOUNTS.inventory, debit: inventoryDebit, credit: inventoryCredit },
      ]),
    } as unknown as ILedgerRepository;
    return new GetInventory(inventory, ledger);
  }

  it("counts low and out items among active ones and compares stock with the books", async () => {
    const summary = await setup(
      [
        item({ id: "a", value: 30_000, level: "low" }),
        item({ id: "b", value: 0, level: "out" }),
        item({ id: "c", value: 20_000, level: "ok" }),
        // Inactive items still count towards value, but not towards the alerts.
        item({ id: "d", value: 5_000, level: "out", isActive: false }),
      ],
      60_000,
      10_000,
    ).execute();

    expect(summary).toMatchObject({ lowCount: 1, outCount: 1, stockValue: 55_000, booksValue: 50_000, difference: 5_000, costsVisible: true });
    expect(summary.items).toHaveLength(4);
  });

  it("treats a ledger with no inventory movement as zero on the books", async () => {
    const inventory = { listStock: vi.fn(async () => [item()]) } as unknown as IInventoryRepository;
    const ledger = { movements: vi.fn(async () => []) } as unknown as ILedgerRepository;
    const summary = await new GetInventory(inventory, ledger).execute();
    expect(summary).toMatchObject({ booksValue: 0, difference: 50_000 });
    expect(inventory.listStock).toHaveBeenCalledWith(true);
  });
});

describe("ReceiveStock", () => {
  const INPUT: Omit<StockReceiptInput, "createdById" | "createdByName"> = {
    date: "2026-10-20",
    description: "  Milk delivery  ",
    lines: [
      { ingredientId: "milk", quantity: 2000, cost: 80_000 },
      { ingredientId: "beans", quantity: 1000, cost: 20_000 },
    ],
    vatAmount: 10_000,
  };

  function setup(): { useCase: ReceiveStock; receive: ReturnType<typeof vi.fn<IInventoryRepository["receive"]>> } {
    const receive = vi.fn<IInventoryRepository["receive"]>(async () => expense());
    const inventory = { receive } as unknown as IInventoryRepository;
    return { useCase: new ReceiveStock(inventory), receive };
  }

  it("records the delivery under the actor and builds its journal and audit entries", async () => {
    const { useCase, receive } = setup();
    await useCase.execute(INPUT, ACTOR, NOW);

    const [sent, ledgerHook, audit] = receive.mock.calls[0];
    expect(sent).toMatchObject({ description: "Milk delivery", createdById: "a1", createdByName: "Barista", vatAmount: 10_000 });

    const [journal] = ledgerHook(expense(), SETTINGS);
    expect(journal).toMatchObject({ source: "expense", sourceId: "x1", uniqueKey: "expense:x1", createdById: "a1" });
    expect(journal.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 100_000, credit: 0, memo: undefined },
      { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: 10_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.accountsPayable, debit: 0, credit: 110_000 },
    ]);

    expect(audit?.(expense())).toEqual({
      actorId: "a1",
      actorName: "Barista",
      action: "expense.recorded",
      entityType: "expense",
      entityId: "x1",
      entityLabel: "EX-7 Milk delivery",
      changes: [{ field: "amount", before: null, after: "110000" }],
    });
  });

  it.each<[string, Partial<typeof INPUT>, string]>([
    ["a future date", { date: "2026-10-21" }, "date"],
    ["no lines", { lines: [] }, "lines"],
    ["too many lines", { lines: Array.from({ length: MAX_STOCK_LINES + 1 }, () => ({ ingredientId: "milk", quantity: 1, cost: 1 })) }, "lines"],
    ["a zero quantity", { lines: [{ ingredientId: "milk", quantity: 0, cost: 1 }] }, "lines"],
    ["a NaN quantity", { lines: [{ ingredientId: "milk", quantity: Number.NaN, cost: 1 }] }, "lines"],
    ["a fractional cost", { lines: [{ ingredientId: "milk", quantity: 1, cost: 1.5 }] }, "lines"],
    ["a negative cost", { lines: [{ ingredientId: "milk", quantity: 1, cost: -1 }] }, "lines"],
    ["a delivery that cost nothing", { lines: [{ ingredientId: "milk", quantity: 1, cost: 0 }] }, "lines"],
    ["negative VAT", { vatAmount: -1 }, "vatAmount"],
    ["fractional VAT", { vatAmount: 0.5 }, "vatAmount"],
    ["a blank description", { description: "   " }, "description"],
    ["an overlong description", { description: "x".repeat(301) }, "description"],
  ])("refuses %s before writing", async (_label, overrides, field) => {
    const { useCase, receive } = setup();
    await expect(useCase.execute({ ...INPUT, ...overrides }, ACTOR, NOW)).rejects.toMatchObject({ name: "ValidationError", field });
    expect(receive).not.toHaveBeenCalled();
  });
});

describe("RecordWaste", () => {
  it("drops a blank note and posts the waste against the variance account", async () => {
    const recordWaste = vi.fn<IInventoryRepository["recordWaste"]>(async () => movement());
    const useCase = new RecordWaste({ recordWaste } as unknown as IInventoryRepository);
    await useCase.execute({ date: "2026-10-20", ingredientId: "milk", quantity: 200, note: "   " }, ACTOR, NOW);

    const [sent, ledgerHook, actor] = recordWaste.mock.calls[0];
    expect(sent.note).toBeUndefined();
    expect(actor).toBe(ACTOR);
    expect(ledgerHook(EVENT)).toMatchObject({
      source: "stockWaste",
      uniqueKey: "stock:ev1:waste",
      lines: [
        { accountCode: INVENTORY_ACCOUNTS.waste, debit: 10_000, credit: 0 },
        { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: 10_000 },
      ],
    });
  });

  it("keeps a trimmed note", async () => {
    const recordWaste = vi.fn<IInventoryRepository["recordWaste"]>(async () => movement());
    await new RecordWaste({ recordWaste } as unknown as IInventoryRepository).execute(
      { date: "2026-10-20", ingredientId: "milk", quantity: 1, note: " dropped " },
      ACTOR,
      NOW,
    );
    expect(recordWaste.mock.calls[0][0].note).toBe("dropped");
  });

  it("refuses no quantity and a future date", async () => {
    const recordWaste = vi.fn();
    const useCase = new RecordWaste({ recordWaste } as unknown as IInventoryRepository);
    await expect(useCase.execute({ date: "2026-10-20", ingredientId: "milk", quantity: 0 }, ACTOR, NOW)).rejects.toMatchObject({ field: "quantity" });
    await expect(useCase.execute({ date: "2026-11-01", ingredientId: "milk", quantity: 1 }, ACTOR, NOW)).rejects.toMatchObject({ field: "date" });
    expect(recordWaste).not.toHaveBeenCalled();
  });
});

describe("CountStock", () => {
  function setup(): { useCase: CountStock; recordCount: ReturnType<typeof vi.fn<IInventoryRepository["recordCount"]>> } {
    const recordCount = vi.fn<IInventoryRepository["recordCount"]>(async () => ({ id: "c1", variance: -500, adjusted: 1 }));
    return { useCase: new CountStock({ recordCount } as unknown as IInventoryRepository), recordCount };
  }

  it("passes the count on and books a shortage as variance", async () => {
    const { useCase, recordCount } = setup();
    const result = await useCase.execute({ date: "2026-10-20", lines: [{ ingredientId: "milk", counted: 0 }], note: " weekly " }, ACTOR, NOW);
    expect(result).toEqual({ id: "c1", variance: -500, adjusted: 1 });

    const [sent, ledgerHook] = recordCount.mock.calls[0];
    expect(sent.note).toBe("weekly");
    expect(ledgerHook({ ...EVENT, value: -500 })?.lines).toEqual([
      { accountCode: INVENTORY_ACCOUNTS.variance, debit: 500, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 0, credit: 500 },
    ]);
    // A count that matched the shelves posts nothing.
    expect(ledgerHook({ ...EVENT, value: 0 })).toBeNull();
  });

  it("drops a missing note", async () => {
    const { useCase, recordCount } = setup();
    await useCase.execute({ date: "2026-10-20", lines: [{ ingredientId: "milk", counted: 5 }] }, ACTOR, NOW);
    expect(recordCount.mock.calls[0][0].note).toBeUndefined();
  });

  it.each<[string, { ingredientId: string; counted: number }[]]>([
    ["no lines", []],
    ["a negative count", [{ ingredientId: "milk", counted: -1 }]],
    ["a NaN count", [{ ingredientId: "milk", counted: Number.NaN }]],
    [
      "the same item twice",
      [
        { ingredientId: "milk", counted: 1 },
        { ingredientId: "milk", counted: 2 },
      ],
    ],
  ])("refuses %s", async (_label, lines) => {
    const { useCase, recordCount } = setup();
    await expect(useCase.execute({ date: "2026-10-20", lines }, ACTOR, NOW)).rejects.toThrow(ValidationError);
    expect(recordCount).not.toHaveBeenCalled();
  });
});

describe("RecordOpeningStock", () => {
  function setup(): { useCase: RecordOpeningStock; recordOpening: ReturnType<typeof vi.fn<IInventoryRepository["recordOpening"]>> } {
    const recordOpening = vi.fn<IInventoryRepository["recordOpening"]>(async () => ({ id: "o1", value: 10_000 }));
    return { useCase: new RecordOpeningStock({ recordOpening } as unknown as IInventoryRepository), recordOpening };
  }

  it("books opening stock as the owner's capital", async () => {
    const { useCase, recordOpening } = setup();
    const input = { date: "2026-10-01", lines: [{ ingredientId: "milk", quantity: 100, cost: 10_000 }] };
    expect(await useCase.execute(input, ACTOR, NOW)).toEqual({ id: "o1", value: 10_000 });
    const [sent, ledgerHook, actor] = recordOpening.mock.calls[0];
    expect(sent).toBe(input);
    expect(actor).toBe(ACTOR);
    expect(ledgerHook(EVENT)).toMatchObject({
      source: "stockOpening",
      lines: [
        { accountCode: SYSTEM_ACCOUNTS.inventory, debit: 10_000, credit: 0 },
        { accountCode: SYSTEM_ACCOUNTS.ownerCapital, debit: 0, credit: 10_000 },
      ],
    });
  });

  it.each<[string, { ingredientId: string; quantity: number; cost: number }[]]>([
    ["no lines", []],
    ["a zero quantity", [{ ingredientId: "milk", quantity: 0, cost: 1 }]],
    ["a negative cost", [{ ingredientId: "milk", quantity: 1, cost: -5 }]],
    ["a fractional cost", [{ ingredientId: "milk", quantity: 1, cost: 0.1 }]],
  ])("refuses %s", async (_label, lines) => {
    const { useCase, recordOpening } = setup();
    await expect(useCase.execute({ date: "2026-10-01", lines }, ACTOR, NOW)).rejects.toMatchObject({ field: "lines" });
    expect(recordOpening).not.toHaveBeenCalled();
  });
});

describe("SetReorderLevel", () => {
  it("sets or clears the level", async () => {
    const setReorderLevel = vi.fn<IInventoryRepository["setReorderLevel"]>(async () => {});
    const useCase = new SetReorderLevel({ setReorderLevel } as unknown as IInventoryRepository);
    await useCase.execute("milk", 500);
    await useCase.execute("milk", null);
    expect(setReorderLevel.mock.calls).toEqual([
      ["milk", 500],
      ["milk", null],
    ]);
  });

  it("refuses a negative level", async () => {
    const setReorderLevel = vi.fn();
    await expect(new SetReorderLevel({ setReorderLevel } as unknown as IInventoryRepository).execute("milk", -1)).rejects.toThrow(
      ValidationError,
    );
    expect(setReorderLevel).not.toHaveBeenCalled();
  });
});
