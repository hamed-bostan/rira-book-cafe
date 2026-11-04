import { describe, expect, it } from "vitest";

import { PUT as updateIngredient } from "@/app/api/admin/ingredients/[id]/route";
import { POST as countStock } from "@/app/api/admin/inventory/counts/route";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { prisma } from "@/src/infrastructure/prisma/client";

import { jsonRequest, readError, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * A stock item's edit form (Pricing → Ingredients): its unit is fixed once it holds
 * stock or has moved, and it can't be switched off while it holds stock or a
 * published item's recipe uses it.
 */

const today = cafeDayOf(new Date());

/** Save the item's form as it stands, with `changes` typed over it. */
async function save(id: string, changes: Record<string, unknown>): Promise<Response> {
  signInAs("admin");
  const row = await prisma.ingredient.findUniqueOrThrow({ where: { id } });
  return updateIngredient(
    jsonRequest("PUT", `/api/admin/ingredients/${id}`, {
      name: row.name,
      unit: row.unit,
      purchasePrice: String(row.purchasePrice),
      purchaseQuantity: String(row.purchaseQuantity),
      isActive: row.isActive,
      ...changes,
    }),
    routeParams({ id }),
  );
}

async function countToZero(ingredientId: string): Promise<void> {
  signInAs("admin");
  const response = await countStock(
    jsonRequest("POST", "/api/admin/inventory/counts", {
      date: today,
      lines: [{ ingredientId, counted: "0" }],
      note: "",
    }),
  );
  expect(response.status).toBe(201);
}

describe("a stock item's unit", () => {
  it("is kept once the item holds stock or has moved, even counted back to zero", async () => {
    const held = await save("seed-ing-milk", { unit: "g" });
    expect(held.status).toBe(409);
    expect(await readError(held)).toMatchObject({ code: "UNIT_LOCKED", fieldErrors: { unit: "unitLocked" } });

    await countToZero("seed-ing-milk");
    expect((await save("seed-ing-milk", { unit: "g" })).status).toBe(409);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: "seed-ing-milk" } })).unit).toBe("ml");

    // A price change on the same item still saves.
    expect((await save("seed-ing-milk", { purchasePrice: "80000" })).status).toBe(200);
  });

  it("can change while nothing has moved the item", async () => {
    const fresh = await prisma.ingredient.create({
      data: { name: "Oat milk", unit: "ml", purchasePrice: BigInt(90_000), purchaseQuantity: 1000 },
    });

    expect((await save(fresh.id, { unit: "g" })).status).toBe(200);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: fresh.id } })).unit).toBe("g");
  });
});

describe("switching a stock item off", () => {
  it("is refused while the item holds stock", async () => {
    const response = await save("seed-ing-cheese", { isActive: false });

    expect(response.status).toBe(409);
    expect(await readError(response)).toMatchObject({ code: "STOCK_ON_HAND" });
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: "seed-ing-cheese" } })).isActive).toBe(true);
  });

  it("is refused while a published item's recipe uses it, and goes through once that's off the menu", async () => {
    await countToZero("seed-ing-cheese");

    const response = await save("seed-ing-cheese", { isActive: false });
    expect(response.status).toBe(409);
    expect(await readError(response)).toMatchObject({ code: "INGREDIENT_IN_RECIPE" });

    const recipes = await prisma.recipeLine.findMany({ where: { ingredientId: "seed-ing-cheese" } });
    await prisma.product.updateMany({
      where: { id: { in: recipes.map((line) => line.productId) } },
      data: { isPublished: false },
    });
    expect((await save("seed-ing-cheese", { isActive: false })).status).toBe(200);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: "seed-ing-cheese" } })).isActive).toBe(false);
  });
});
