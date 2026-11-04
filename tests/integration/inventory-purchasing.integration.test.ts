import { describe, expect, it } from "vitest";

import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { PUT as updateIngredient } from "@/app/api/admin/ingredients/[id]/route";
import { POST as adjustStock } from "@/app/api/admin/inventory/adjustments/route";
import { POST as countStock } from "@/app/api/admin/inventory/counts/route";
import { GET as listDeliveries } from "@/app/api/admin/inventory/deliveries/route";
import { PUT as editItem } from "@/app/api/admin/inventory/items/[id]/route";
import { POST as createItem } from "@/app/api/admin/inventory/items/route";
import { GET as exportMovements } from "@/app/api/admin/inventory/movements/export/route";
import { GET as listMovements } from "@/app/api/admin/inventory/movements/route";
import { GET as getOnHandAt } from "@/app/api/admin/inventory/on-hand/route";
import { POST as receiveStock } from "@/app/api/admin/inventory/receipts/route";
import { GET as listReturns, POST as returnStock } from "@/app/api/admin/inventory/returns/route";
import { GET as getInventory } from "@/app/api/admin/inventory/route";
import { POST as recordWaste } from "@/app/api/admin/inventory/waste/route";
import { PUT as savePricingSettings } from "@/app/api/admin/pricing/settings/route";
import { PUT as saveRecipe } from "@/app/api/admin/recipes/[productId]/route";
import { POST as createSupplier } from "@/app/api/admin/suppliers/route";
import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Expense, Supplier } from "@/src/domain/entities/Expense";
import type { InventorySummary, StockMovement, SupplierReturn } from "@/src/domain/entities/Inventory";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * Purchasing and stock control: pack sizes on deliveries, stock items made and
 * edited from Inventory, returns to suppliers with their credit notes, reason-coded
 * adjustments, the movements' running balance and CSV, backdated counts, recipe
 * costing at average cost, and the activity log behind every hand-made change.
 */

const today = cafeDayOf(new Date());
const yesterday = shiftCafeDay(today, -1);

async function inventory(): Promise<InventorySummary> {
  const response = await getInventory();
  expect(response.status).toBe(200);
  return readJson<InventorySummary>(response);
}

async function trialBalance(): Promise<TrialBalance> {
  const response = await getReport(
    getRequest(`/api/admin/accounting/reports/trial-balance?asOf=${today}`),
    routeParams({ report: "trial-balance" }),
  );
  expect(response.status).toBe(200);
  return readJson<TrialBalance>(response);
}

/** The books balance and the stock list is worth exactly the Inventory account. */
async function expectBooksAgree(): Promise<void> {
  signInAs("admin");
  const balance = await trialBalance();
  expect(balance.balanced).toBe(true);
  const stock = await inventory();
  expect(stock.difference).toBe(0);
  expect(balance.rows.find((row) => row.account.code === SYSTEM_ACCOUNTS.inventory)?.balance).toBe(stock.stockValue);
}

async function supplier(name: string): Promise<Supplier> {
  signInAs("admin");
  const response = await createSupplier(
    jsonRequest("POST", "/api/admin/suppliers", { name, phone: "", note: "", isActive: true }),
  );
  expect(response.status).toBe(201);
  return readJson<Supplier>(response);
}

async function newItem(body: Record<string, unknown>): Promise<{ id: string; name: string }> {
  signInAs("admin");
  const response = await createItem(
    jsonRequest("POST", "/api/admin/inventory/items", {
      unit: "g",
      reorderLevel: "",
      parLevel: "",
      purchaseUnits: [],
      supplierId: "",
      ...body,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<{ id: string; name: string }>(response);
}

async function deliver(
  lines: Record<string, string>[],
  options: { supplierId?: string; payment?: string; vatAmount?: string } = {},
): Promise<Expense> {
  signInAs("admin");
  const response = await receiveStock(
    jsonRequest("POST", "/api/admin/inventory/receipts", {
      date: today,
      supplierId: options.supplierId ?? "",
      description: "Delivery",
      lines,
      vatAmount: options.vatAmount ?? "",
      payment: options.payment ?? "unpaid",
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Expense>(response);
}

async function movements(query: string): Promise<Page<StockMovement>> {
  const response = await listMovements(getRequest(`/api/admin/inventory/movements?${query}`));
  expect(response.status).toBe(200);
  return readJson<Page<StockMovement>>(response);
}

async function item(id: string): Promise<InventorySummary["items"][number]> {
  signInAs("admin");
  const found = (await inventory()).items.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no item ${id}`);
  return found;
}

describe("stock items from Inventory", () => {
  it("are made and edited by those who manage stock, through the same use-case as Pricing", async () => {
    signInAs("staff");
    expect(
      (await createItem(jsonRequest("POST", "/api/admin/inventory/items", { name: "Oat milk", unit: "ml" }))).status,
    ).toBe(401);

    const shop = await supplier("Dairy Co");
    const created = await newItem({
      name: "Oat milk",
      unit: "ml",
      reorderLevel: "2000",
      parLevel: "8000",
      purchaseUnits: [{ name: "carton", factor: "1000" }],
      supplierId: shop.id,
    });
    const row = await item(created.id);
    expect(row).toMatchObject({
      onHand: 0,
      reorderLevel: 2000,
      parLevel: 8000,
      purchaseUnits: [{ name: "carton", factor: 1000 }],
      supplierId: shop.id,
      supplierName: "Dairy Co",
    });

    const response = await editItem(
      jsonRequest("PUT", `/api/admin/inventory/items/${created.id}`, {
        name: "Oat milk (barista)",
        unit: "ml",
        reorderLevel: "3000",
        parLevel: "",
        purchaseUnits: [
          { name: "carton", factor: "1000" },
          { name: "case", factor: "6000" },
        ],
        supplierId: "",
      }),
      routeParams({ id: created.id }),
    );
    expect(response.status).toBe(200);
    const edited = await item(created.id);
    expect(edited).toMatchObject({
      name: "Oat milk (barista)",
      reorderLevel: 3000,
    });
    expect(edited.parLevel).toBeUndefined();
    expect(edited.supplierId).toBeUndefined();

    const log = await prisma.activityEntry.findMany({ where: { entityId: created.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((entry) => entry.action)).toEqual(["stockItem.created", "stockItem.updated"]);
    expect(log[1].changedFields).toEqual(expect.arrayContaining(["name", "reorderLevel", "parLevel", "purchaseUnits"]));
  });

  it("refuses a par level below the reorder level", async () => {
    const created = await newItem({ name: "Matcha" });
    const response = await editItem(
      jsonRequest("PUT", `/api/admin/inventory/items/${created.id}`, {
        name: "Matcha",
        unit: "g",
        reorderLevel: "500",
        parLevel: "100",
        purchaseUnits: [],
        supplierId: "",
      }),
      routeParams({ id: created.id }),
    );
    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors?.parLevel).toBe("parBelowReorder");
  });

  it("keeps Pricing's price edit and Inventory's level edit from overwriting each other", async () => {
    signInAs("admin");
    const created = await newItem({
      name: "Cardamom",
      reorderLevel: "50",
      purchaseUnits: [{ name: "jar", factor: "100" }],
    });
    const response = await updateIngredient(
      jsonRequest("PUT", `/api/admin/ingredients/${created.id}`, {
        name: "Cardamom",
        unit: "g",
        purchasePrice: "300000",
        purchaseQuantity: "100",
        isActive: true,
      }),
      routeParams({ id: created.id }),
    );
    expect(response.status).toBe(200);
    expect(await item(created.id)).toMatchObject({ reorderLevel: 50, purchaseUnits: [{ name: "jar", factor: 100 }] });
  });
});

describe("purchase units on deliveries", () => {
  it("brings packs into stock in the base unit, at the cost typed per pack", async () => {
    const created = await newItem({ name: "House blend", purchaseUnits: [{ name: "bag", factor: "1000" }] });
    await deliver([{ ingredientId: created.id, quantity: "3", unit: "bag", cost: "450000", costPer: "unit" }]);

    const row = await item(created.id);
    expect(row.onHand).toBe(3000);
    expect(row.value).toBe(1_350_000);
    expect(row.averageCost).toBe(450);
    const page = await movements(`item=${created.id}`);
    expect(page.items[0]).toMatchObject({ kind: "receipt", quantity: 3000, value: 1_350_000, note: "3 × bag" });
    await expectBooksAgree();
  });

  it("refuses a unit the item isn't bought in", async () => {
    const created = await newItem({ name: "Decaf" });
    signInAs("admin");
    const response = await receiveStock(
      jsonRequest("POST", "/api/admin/inventory/receipts", {
        date: today,
        supplierId: "",
        description: "Decaf",
        lines: [{ ingredientId: created.id, quantity: "2", unit: "sack", cost: "100000", costPer: "line" }],
        vatAmount: "",
        payment: "cash",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("returns to suppliers", () => {
  it("takes the goods out at average cost and settles the credit against the delivery's bill", async () => {
    const shop = await supplier("Bean Roasters");
    const created = await newItem({ name: "Single origin" });
    const delivery = await deliver([{ ingredientId: created.id, quantity: "2000", cost: "1000000" }], {
      supplierId: shop.id,
      vatAmount: "100000",
    });
    expect(delivery.amount).toBe(1_100_000);

    signInAs("admin");
    const deliveries = await readJson<{ id: string; owed: number }[]>(await listDeliveries());
    expect(deliveries.find((row) => row.id === delivery.id)?.owed).toBe(1_100_000);

    // 500 g back (worth 250,000 at average cost), credited 330,000 with 30,000 VAT:
    // a 50,000 price difference in the cafe's favour.
    const response = await returnStock(
      jsonRequest("POST", "/api/admin/inventory/returns", {
        date: today,
        supplierId: shop.id,
        expenseId: delivery.id,
        lines: [{ ingredientId: created.id, quantity: "500" }],
        creditAmount: "330000",
        vatAmount: "30000",
        refundTo: "",
        note: "Stale bags",
      }),
    );
    expect(response.status).toBe(201);
    const saved = await readJson<SupplierReturn>(response);
    expect(saved).toMatchObject({ appliedAmount: 330_000, refundedAmount: 0, stockValue: 250_000 });

    expect((await item(created.id)).onHand).toBe(1500);
    const bill = await prisma.expense.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(Number(bill.paidAmount)).toBe(330_000);
    expect(bill.status).toBe("unpaid");

    const entry = await prisma.journalEntry.findFirstOrThrow({
      where: { sourceId: saved.id, source: "supplierReturn" },
      include: { lines: true },
    });
    const line = (code: string): { debit: number; credit: number } => {
      const found = entry.lines.filter((row) => row.accountCode === code);
      return {
        debit: found.reduce((sum, row) => sum + Number(row.debit), 0),
        credit: found.reduce((sum, row) => sum + Number(row.credit), 0),
      };
    };
    expect(line(SYSTEM_ACCOUNTS.accountsPayable)).toEqual({ debit: 330_000, credit: 0 });
    expect(line(SYSTEM_ACCOUNTS.inventory)).toEqual({ debit: 0, credit: 250_000 });
    expect(line(SYSTEM_ACCOUNTS.vatPayable)).toEqual({ debit: 0, credit: 30_000 });
    expect(line("5300")).toEqual({ debit: 0, credit: 50_000 });

    const page = await movements(`item=${created.id}&kind=return_to_supplier`);
    expect(page.items[0]).toMatchObject({ kind: "return_to_supplier", quantity: -500, value: -250_000 });

    const listed = await readJson<SupplierReturn[]>(
      await listReturns(getRequest(`/api/admin/inventory/returns?expense=${delivery.id}`)),
    );
    expect(listed.map((row) => row.id)).toEqual([saved.id]);
    expect(listed[0].lines).toEqual([
      { ingredientId: created.id, ingredientName: "Single origin", quantity: 500, value: 250_000 },
    ]);

    // The trial balance holds and the AP account still equals what's owed on bills.
    await expectBooksAgree();
    const balance = await trialBalance();
    const owed = await prisma.expense.findMany({ where: { status: "unpaid" } });
    expect(balance.rows.find((row) => row.account.code === SYSTEM_ACCOUNTS.accountsPayable)?.balance).toBe(
      owed.reduce((sum, row) => sum + Number(row.amount - row.paidAmount), 0),
    );

    // The delivery can no longer be voided: the return stands against its bill.
    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${delivery.id}/void`, { reason: "" }),
      routeParams({ id: delivery.id }),
    );
    expect(voided.status).toBe(409);
    expect((await readError(voided)).code).toBe("DELIVERY_HAS_RETURNS");

    const log = await prisma.activityEntry.findMany({ where: { action: "stockItem.returnedToSupplier" } });
    expect(log.map((entry) => entry.entityId)).toEqual([created.id]);
  });

  it("refunds what a paid bill can't take, and refuses a refund with nowhere to go", async () => {
    const shop = await supplier("Cup Co");
    const created = await newItem({ name: "Paper cups", unit: "piece" });
    const delivery = await deliver([{ ingredientId: created.id, quantity: "100", cost: "200000" }], {
      supplierId: shop.id,
      payment: "bank",
    });
    signInAs("admin");
    const body = {
      date: today,
      supplierId: shop.id,
      expenseId: delivery.id,
      lines: [{ ingredientId: created.id, quantity: "20" }],
      creditAmount: "40000",
      vatAmount: "",
      note: "",
    };
    const nowhere = await returnStock(jsonRequest("POST", "/api/admin/inventory/returns", { ...body, refundTo: "" }));
    expect(nowhere.status).toBe(400);
    expect((await readError(nowhere)).fieldErrors?.refundTo).toBe("refundToRequired");

    const response = await returnStock(
      jsonRequest("POST", "/api/admin/inventory/returns", { ...body, refundTo: "cash" }),
    );
    expect(response.status).toBe(201);
    expect(await readJson<SupplierReturn>(response)).toMatchObject({
      appliedAmount: 0,
      refundedAmount: 40_000,
      refundedTo: "cash",
      stockValue: 40_000,
    });
    await expectBooksAgree();
  });

  it("never sends back more than is on hand", async () => {
    const shop = await supplier("Syrups");
    signInAs("admin");
    const response = await returnStock(
      jsonRequest("POST", "/api/admin/inventory/returns", {
        date: today,
        supplierId: shop.id,
        expenseId: "",
        lines: [{ ingredientId: "seed-ing-beans", quantity: "999999" }],
        creditAmount: "",
        vatAmount: "",
        refundTo: "",
        note: "",
      }),
    );
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("RETURN_EXCEEDS_STOCK");
  });
});

describe("reason-coded adjustments", () => {
  async function adjust(body: Record<string, unknown>): Promise<Response> {
    signInAs("admin");
    return adjustStock(
      jsonRequest("POST", "/api/admin/inventory/adjustments", {
        date: today,
        ingredientId: "seed-ing-beans",
        direction: "out",
        quantity: "100",
        reason: "staffMeal",
        note: "",
        ...body,
      }),
    );
  }

  it("posts a staff meal to staff meals and found stock to inventory variance", async () => {
    const before = await item("seed-ing-beans");
    expect((await adjust({})).status).toBe(201);
    expect((await adjust({ direction: "in", quantity: "40", reason: "found" })).status).toBe(201);

    expect((await item("seed-ing-beans")).onHand).toBe(before.onHand - 60);
    const entries = await prisma.journalEntry.findMany({
      where: { source: "stockAdjustment" },
      include: { lines: true },
      orderBy: { number: "asc" },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].lines.find((line) => Number(line.debit) > 0)?.accountCode).toBe("6410");
    expect(entries[1].lines.find((line) => Number(line.credit) > 0)?.accountCode).toBe("5300");

    const page = await movements("item=seed-ing-beans&kind=adjustment");
    expect(page.items.map((movement) => movement.reason)).toEqual(["found", "staffMeal"]);
    const log = await prisma.activityEntry.findMany({ where: { action: "stockItem.adjusted" } });
    expect(log).toHaveLength(2);
    await expectBooksAgree();
  });

  it('refuses a reason moving the wrong way, and "other" without a note', async () => {
    const wrongWay = await adjust({ direction: "in", reason: "staffMeal" });
    expect(wrongWay.status).toBe(400);
    expect((await readError(wrongWay)).fieldErrors?.direction).toBe("adjustmentDirection");
    const noNote = await adjust({ reason: "other" });
    expect(noNote.status).toBe(400);
    expect((await readError(noNote)).fieldErrors?.note).toBe("adjustmentNoteRequired");
  });

  it("is for those who manage stock", async () => {
    signInAs("staff");
    expect(
      (
        await adjustStock(
          jsonRequest("POST", "/api/admin/inventory/adjustments", {
            date: today,
            ingredientId: "seed-ing-beans",
            direction: "out",
            quantity: "1",
            reason: "damaged",
            note: "",
          }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("the movements ledger", () => {
  it("carries one item's running balance, and a CSV with values only for those who see costs", async () => {
    const created = await newItem({ name: "Vanilla syrup", unit: "ml" });
    await deliver([{ ingredientId: created.id, quantity: "1000", cost: "200000" }], { payment: "cash" });
    signInAs("staff");
    const waste = await recordWaste(
      jsonRequest("POST", "/api/admin/inventory/waste", {
        date: today,
        ingredientId: created.id,
        quantity: "150",
        note: "",
      }),
    );
    expect(waste.status).toBe(201);
    await deliver([{ ingredientId: created.id, quantity: "500", cost: "100000" }], { payment: "cash" });

    signInAs("admin");
    const page = await movements(`item=${created.id}&pageSize=2`);
    expect(page.items.map((movement) => movement.balanceAfter)).toEqual([1350, 850]);
    const second = await movements(`item=${created.id}&pageSize=2&page=2`);
    expect(second.items.map((movement) => movement.balanceAfter)).toEqual([1000]);

    const adminCsv = await (
      await exportMovements(getRequest(`/api/admin/inventory/movements/export?item=${created.id}&locale=en`))
    ).text();
    const adminRows = adminCsv.replace("﻿", "").trim().split("\r\n");
    expect(adminRows[0]).toBe("Date,Item,Type,Reason,Quantity,Unit,Value (Toman),On hand after,Note,By");
    expect(adminRows).toHaveLength(4);
    expect(adminRows[1]).toContain(",1000,ml,200000,1000,");
    expect(adminRows[3]).toContain(",500,ml,100000,1350,");

    signInAs("staff");
    const staffCsv = await (
      await exportMovements(getRequest(`/api/admin/inventory/movements/export?item=${created.id}&locale=en`))
    ).text();
    expect(staffCsv).not.toContain("Value (Toman)");
    expect(staffCsv).not.toContain("200000");

    // The waste is in the activity log, as the stock item's.
    const log = await prisma.activityEntry.findMany({ where: { entityId: created.id, action: "stockItem.wasted" } });
    expect(log).toHaveLength(1);
  });

  it("narrows to a span of days", async () => {
    signInAs("admin");
    const future = await movements(`from=${shiftCafeDay(today, 1)}`);
    expect(future.items).toHaveLength(0);
    const todays = await movements(`from=${today}&to=${today}`);
    expect(todays.items.length).toBeGreaterThan(0);
    expect(todays.items.every((movement) => movement.date === today)).toBe(true);
  });
});

describe("backdated counts", () => {
  it("compare with what was on hand at the end of the count's day, and apply the difference today", async () => {
    signInAs("admin");
    const created = await newItem({ name: "Cocoa" });
    // On hand yesterday: 1000 g. Today another 500 g came in.
    signInAs("admin");
    await receiveStock(
      jsonRequest("POST", "/api/admin/inventory/receipts", {
        date: yesterday,
        supplierId: "",
        description: "Cocoa",
        lines: [{ ingredientId: created.id, quantity: "1000", cost: "500000" }],
        vatAmount: "",
        payment: "cash",
      }),
    );
    await deliver([{ ingredientId: created.id, quantity: "500", cost: "250000" }], { payment: "cash" });

    const then = await readJson<{ items: { id: string; onHand: number }[] }>(
      await getOnHandAt(getRequest(`/api/admin/inventory/on-hand?date=${yesterday}`)),
    );
    expect(then.items.find((row) => row.id === created.id)?.onHand).toBe(1000);

    // Last night's sheet said 900 g: 100 g short then, so 1400 g now — not 600 g over.
    const response = await countStock(
      jsonRequest("POST", "/api/admin/inventory/counts", {
        date: yesterday,
        lines: [{ ingredientId: created.id, counted: "900" }],
        note: "",
      }),
    );
    expect(response.status).toBe(201);
    expect(await readJson<{ variance: number }>(response)).toMatchObject({ variance: -50_000 });
    expect((await item(created.id)).onHand).toBe(1400);
    await expectBooksAgree();
  });
});

describe("recipe costing", () => {
  it("costs a recipe at average cost while there's stock, and at the last price once it's gone", async () => {
    const created = await newItem({ name: "Hazelnut syrup", unit: "ml" });
    // 1000 ml at 100 each, then 1000 ml at 300 each: average 200, last price 300.
    await deliver([{ ingredientId: created.id, quantity: "1000", cost: "100000" }], { payment: "cash" });
    await deliver([{ ingredientId: created.id, quantity: "1000", cost: "300000" }], { payment: "cash" });

    signInAs("admin");
    const response = await saveRecipe(
      jsonRequest("PUT", "/api/admin/recipes/seed-espresso", { lines: [{ ingredientId: created.id, quantity: "10" }] }),
      routeParams({ productId: "seed-espresso" }),
    );
    expect(response.status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } })).costPrice).toBe(2000);

    // Count it to zero: the last price paid takes over.
    await countStock(
      jsonRequest("POST", "/api/admin/inventory/counts", {
        date: today,
        lines: [{ ingredientId: created.id, counted: "0" }],
        note: "",
      }),
    );
    expect((await prisma.product.findUniqueOrThrow({ where: { id: "seed-espresso" } })).costPrice).toBe(3000);

    const log = await prisma.activityEntry.findMany({ where: { action: "product.recipeChanged" } });
    expect(log.map((entry) => entry.entityId)).toEqual(["seed-espresso"]);
  });
});

describe("pricing settings", () => {
  it("are in the activity log when they change", async () => {
    signInAs("admin");
    const response = await savePricingSettings(
      jsonRequest("PUT", "/api/admin/pricing/settings", {
        defaultMarkup: "45",
        roundingStep: "5000",
        overheadSource: "ledger",
        manualMonthlyOverhead: "",
        expectedMonthlyUnits: "",
        overheadMonths: "3",
      }),
    );
    expect(response.status).toBe(200);
    const [entry] = await prisma.activityEntry.findMany({ where: { action: "pricing.settingsChanged" } });
    expect(entry.changedFields).toEqual(["defaultMarkupBps"]);
  });
});
