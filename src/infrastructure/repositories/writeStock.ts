import { Prisma } from "@prisma/client";

import {
  consumptionFor,
  roundQuantity,
  type StockMovementKind,
  type StockState,
} from "@/src/domain/entities/Inventory";
import type { RecipeLine } from "@/src/domain/entities/Pricing";

import { dayToDate } from "./writeJournal";

/**
 * The single write path into stock, used inside the caller's transaction (the same
 * one that posts the matching journal entry). Rows are locked first, in id order,
 * so two sales or a sale and a delivery can't interleave and corrupt the average
 * cost; then each change updates the item and appends its movement.
 */

export type LockedStock = StockState & { id: string; name: string };
export type StockActor = { id: string; name: string };

/** Lock the stock items' rows for this transaction and read their current state. */
export async function lockStock(
  tx: Prisma.TransactionClient,
  ids: readonly string[],
): Promise<Map<string, LockedStock>> {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return new Map();
  const rows = await tx.$queryRaw<
    { id: string; name: string; on_hand: number; stock_value: bigint; average_cost: number }[]
  >`
    SELECT id, name, on_hand, stock_value, average_cost FROM ingredients
    WHERE id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`;
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        onHand: row.on_hand,
        value: Number(row.stock_value),
        averageCost: row.average_cost,
      },
    ]),
  );
}

/** Persist a stock item's new state and record the movement that produced it. */
export async function writeMovement(
  tx: Prisma.TransactionClient,
  item: LockedStock,
  next: StockState,
  movement: {
    kind: StockMovementKind;
    quantity: number;
    value: number;
    date: string;
    referenceId?: string;
    note?: string;
  },
  actor: StockActor,
): Promise<LockedStock> {
  await tx.ingredient.update({
    where: { id: item.id },
    data: { onHand: next.onHand, stockValue: BigInt(next.value), averageCost: next.averageCost },
  });
  await tx.stockMovement.create({
    data: {
      ingredientId: item.id,
      kind: movement.kind,
      quantity: roundQuantity(movement.quantity),
      value: BigInt(movement.value),
      date: dayToDate(movement.date),
      referenceId: movement.referenceId ?? null,
      note: movement.note ?? null,
      createdById: actor.id,
      createdByName: actor.name,
    },
  });
  return { ...item, ...next };
}

/**
 * A completed order uses up its items' recipes. Each line with a recipe takes its
 * ingredients out of stock at average cost and records what that cost per unit
 * (`unit_cost`, `stock_tracked`), so the cost-of-sales posting that follows books
 * exactly the value that left Inventory. Stock may go below zero — the sale
 * happened — and then shows as out until a delivery or a count.
 */
export async function consumeStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  day: string,
  actor: StockActor,
): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId }, orderBy: { position: "asc" } });
  const recipeRows = await tx.recipeLine.findMany({
    where: { productId: { in: [...new Set(items.map((item) => item.productId))] } },
    orderBy: { position: "asc" },
  });
  if (recipeRows.length === 0) return;

  const recipes = new Map<string, RecipeLine[]>();
  for (const row of recipeRows) {
    const lines = recipes.get(row.productId) ?? [];
    lines.push({ ingredientId: row.ingredientId, quantity: row.quantity });
    recipes.set(row.productId, lines);
  }
  const stock = await lockStock(
    tx,
    recipeRows.map((row) => row.ingredientId),
  );

  for (const item of items) {
    const recipe = recipes.get(item.productId);
    if (!recipe) continue;
    const consumption = consumptionFor(recipe, item.quantity, stock);
    for (const line of consumption.lines) {
      const current = stock.get(line.ingredientId);
      if (!current || line.quantity === 0) continue;
      const next = {
        onHand: roundQuantity(current.onHand - line.quantity),
        value: current.value - line.value,
        averageCost: current.averageCost,
      };
      stock.set(
        line.ingredientId,
        await writeMovement(
          tx,
          current,
          next,
          { kind: "sale", quantity: -line.quantity, value: -line.value, date: day, referenceId: orderId },
          actor,
        ),
      );
    }
    await tx.orderItem.update({ where: { id: item.id }, data: { unitCost: consumption.unitCost, stockTracked: true } });
  }
}
