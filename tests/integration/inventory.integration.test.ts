import { describe, expect, it } from "vitest";

import { POST as receiveStock } from "@/app/api/admin/inventory/receipts/route";
import { GET as getInventory } from "@/app/api/admin/inventory/route";
import { POST as recordWaste } from "@/app/api/admin/inventory/waste/route";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { InventorySummary } from "@/src/domain/entities/Inventory";

import { jsonRequest, readError, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());

async function inventory(): Promise<InventorySummary> {
  const response = await getInventory();
  expect(response.status).toBe(200);
  return readJson<InventorySummary>(response);
}

function onHand(summary: InventorySummary, id: string): number | undefined {
  return summary.items.find((item) => item.id === id)?.onHand;
}

describe("inventory", () => {
  it("shows staff the stock without costs, and accountants with them", async () => {
    signInAs("staff");
    const staffView = await inventory();
    expect(staffView.costsVisible).toBe(false);
    expect(onHand(staffView, "seed-ing-beans")).toBe(6000);

    signInAs("admin");
    const adminView = await inventory();
    expect(adminView.costsVisible).toBe(true);
    // The seed's opening stock went through the journal, so stock and books agree.
    expect(adminView.difference).toBe(0);
  });

  it("is closed to guests", async () => {
    signInAs("customer");

    expect((await getInventory()).status).toBe(401);
  });

  it("receives a delivery, raising stock and the Inventory account together", async () => {
    signInAs("admin");

    const response = await receiveStock(
      jsonRequest("POST", "/api/admin/inventory/receipts", {
        date: today,
        supplierId: "",
        description: "Weekly milk",
        lines: [{ ingredientId: "seed-ing-milk", quantity: "5000", cost: "350000" }],
        vatAmount: "",
        payment: "cash",
      }),
    );

    expect(response.status).toBe(201);
    const after = await inventory();
    expect(onHand(after, "seed-ing-milk")).toBe(13000);
    expect(after.difference).toBe(0);
  });

  it("refuses a delivery from staff without inventory.manage", async () => {
    signInAs("staff");

    const response = await receiveStock(
      jsonRequest("POST", "/api/admin/inventory/receipts", {
        date: today,
        supplierId: "",
        description: "Milk",
        lines: [{ ingredientId: "seed-ing-milk", quantity: "1000", cost: "70000" }],
        vatAmount: "",
        payment: "cash",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("validates a delivery with 400", async () => {
    signInAs("admin");

    const response = await receiveStock(
      jsonRequest("POST", "/api/admin/inventory/receipts", {
        date: today,
        supplierId: "",
        description: "",
        lines: [],
        vatAmount: "",
        payment: "cash",
      }),
    );

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ description: "descriptionRequired", lines: "linesTooFew" });
  });

  it("writes off waste, letting stock run below zero as the ledger allows", async () => {
    signInAs("admin");

    const wasted = await recordWaste(
      jsonRequest("POST", "/api/admin/inventory/waste", { date: today, ingredientId: "seed-ing-milk", quantity: "500", note: "Soured" }),
    );
    expect(wasted.status).toBe(201);
    expect(onHand(await inventory(), "seed-ing-milk")).toBe(7500);

    // Stock may go negative by design (see writeStock.ts): the item then reads as out.
    const overdrawn = await recordWaste(
      jsonRequest("POST", "/api/admin/inventory/waste", { date: today, ingredientId: "seed-ing-mint", quantity: "10", note: "" }),
    );
    expect(overdrawn.status).toBe(201);
    const mint = (await inventory()).items.find((item) => item.id === "seed-ing-mint");
    expect(mint).toMatchObject({ onHand: -10, level: "out" });
  });

  it("answers 404 when wasting an item that doesn't exist", async () => {
    signInAs("admin");

    const response = await recordWaste(
      jsonRequest("POST", "/api/admin/inventory/waste", { date: today, ingredientId: "missing", quantity: "1", note: "" }),
    );

    expect(response.status).toBe(404);
  });
});
