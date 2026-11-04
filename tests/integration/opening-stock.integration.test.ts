import { describe, expect, it } from "vitest";

import { POST as createIngredient } from "@/app/api/admin/ingredients/route";
import { POST as recordOpening } from "@/app/api/admin/inventory/opening/route";
import { GET as getInventory } from "@/app/api/admin/inventory/route";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { InventorySummary, StockItem } from "@/src/domain/entities/Inventory";
import { prisma } from "@/src/infrastructure/prisma/client";

import { jsonRequest, readError, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * Opening stock is what was on the shelves when tracking started, against the
 * owner's capital: once per item, before anything else has moved it.
 */

const today = cafeDayOf(new Date());

async function stockItem(id: string): Promise<StockItem | undefined> {
  signInAs("admin");
  const summary = await readJson<InventorySummary>(await getInventory());
  return summary.items.find((item) => item.id === id);
}

async function open(lines: { ingredientId: string; quantity: string; cost: string }[]): Promise<Response> {
  signInAs("admin");
  return recordOpening(jsonRequest("POST", "/api/admin/inventory/opening", { date: today, lines }));
}

async function newItem(name: string): Promise<string> {
  signInAs("admin");
  const response = await createIngredient(
    jsonRequest("POST", "/api/admin/ingredients", {
      name,
      unit: "piece",
      purchasePrice: "50000",
      purchaseQuantity: "1",
      isActive: true,
    }),
  );
  expect(response.status).toBe(201);
  return (await readJson<{ id: string }>(response)).id;
}

describe("opening stock", () => {
  it("is recorded once per item, before anything else has moved it", async () => {
    const jars = await newItem("Honey jar");
    expect(await stockItem(jars)).toMatchObject({ hasHistory: false });

    expect((await open([{ ingredientId: jars, quantity: "10", cost: "500000" }])).status).toBe(201);
    expect(await stockItem(jars)).toMatchObject({ onHand: 10, hasHistory: true });

    const capital = await prisma.journalEntry.count({ where: { source: "stockOpening" } });
    const again = await open([{ ingredientId: jars, quantity: "10", cost: "500000" }]);
    expect(again.status).toBe(409);
    expect(await readError(again)).toMatchObject({
      code: "STOCK_HAS_HISTORY",
      fieldErrors: { "lines.0.ingredientId": "stockHasHistory" },
    });
    expect(await stockItem(jars)).toMatchObject({ onHand: 10 });
    expect(await prisma.journalEntry.count({ where: { source: "stockOpening" } })).toBe(capital);
  });

  it("refuses the whole entry, naming each line whose item has history", async () => {
    const jars = await newItem("Honey jar");

    const response = await open([
      { ingredientId: jars, quantity: "4", cost: "200000" },
      { ingredientId: "seed-ing-milk", quantity: "1000", cost: "70000" },
    ]);

    expect(response.status).toBe(409);
    expect((await readError(response)).fieldErrors).toEqual({ "lines.1.ingredientId": "stockHasHistory" });
    expect(await stockItem(jars)).toMatchObject({ onHand: 0, hasHistory: false });
  });
});
