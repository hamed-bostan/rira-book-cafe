import {
  consumptionFor,
  receiveStock,
  roundQuantity,
  type StockMovementKind,
  type StockState,
} from "@/src/domain/entities/Inventory";
import { allocate } from "@/src/domain/entities/Ledger";
import type { RecipeLine } from "@/src/domain/entities/Pricing";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

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

/**
 * Persist a stock item's new state and record the movement that produced it.
 *
 * A tracked book's copies are counted once: by the stock item Inventory keeps
 * behind it. Its sale stock (`products.stock_quantity`, what the storefront sells
 * from) follows every movement here, in the same transaction — a delivery, a
 * count, waste, an opening, a voided delivery. Order flows move the sale stock
 * themselves (taken when an order is placed, put back when it's cancelled or
 * refunded to the shelf) and say so with `shelfMoved`, as does tracking a book
 * whose shelf already holds its copies.
 */
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
    /** An adjustment's reason code. */
    reason?: string;
    /** The caller already moved the sale stock of any book this item stands behind. */
    shelfMoved?: boolean;
  },
  actor: StockActor,
): Promise<LockedStock> {
  await tx.ingredient.update({
    where: { id: item.id },
    data: { onHand: next.onHand, stockValue: BigInt(next.value), averageCost: next.averageCost },
  });
  if (!movement.shelfMoved) await moveBookShelves(tx, item, next);
  await tx.stockMovement.create({
    data: {
      ingredientId: item.id,
      kind: movement.kind,
      quantity: roundQuantity(movement.quantity),
      value: BigInt(movement.value),
      date: dayToDate(movement.date),
      referenceId: movement.referenceId ?? null,
      note: movement.note ?? null,
      reason: movement.reason ?? null,
      createdById: actor.id,
      createdByName: actor.name,
    },
  });
  return { ...item, ...next };
}

/**
 * Move the sale stock of every tracked book this stock item stands behind — a book
 * whose recipe is this one item — by what its copies on hand changed. Whole
 * copies: each side is rounded before taking the difference, so a fraction typed
 * into a count can never make the two counts drift apart. Runs after the item's
 * row is locked, so the lock order is always stock item, then product.
 */
async function moveBookShelves(tx: Prisma.TransactionClient, item: LockedStock, next: StockState): Promise<void> {
  if (next.onHand === item.onHand) return;
  const books = await tx.$queryRaw<{ product_id: string; quantity: number }[]>`
    SELECT rl.product_id, rl.quantity FROM recipe_lines rl
    JOIN products p ON p.id = rl.product_id
    WHERE rl.ingredient_id = ${item.id} AND p.kind = 'book' AND p.made_to_order = false AND rl.quantity > 0
      AND NOT EXISTS (
        SELECT 1 FROM recipe_lines other
        WHERE other.product_id = rl.product_id AND other.ingredient_id <> rl.ingredient_id
      )
    ORDER BY rl.product_id`;
  for (const book of books) {
    const change = Math.round(next.onHand / book.quantity) - Math.round(item.onHand / book.quantity);
    if (change === 0) continue;
    await tx.product.update({ where: { id: book.product_id }, data: { stockQuantity: { increment: change } } });
  }
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
          // The order took its units off the shelf when it was placed.
          {
            kind: "sale",
            quantity: -line.quantity,
            value: -line.value,
            date: day,
            referenceId: orderId,
            shelfMoved: true,
          },
          actor,
        ),
      );
    }
    await tx.orderItem.update({ where: { id: item.id }, data: { unitCost: consumption.unitCost, stockTracked: true } });
  }
}

/**
 * Refunded units going back on the shelf come back into stock at what the sale took
 * out (`unitCost` per unit), split across the line's recipe by what each ingredient
 * is worth. Lines that were never stock-tracked have nothing to come back. Returns
 * the value restored, which the refund's cost-of-sales posting books exactly.
 */
export async function returnStockForRefund(
  tx: Prisma.TransactionClient,
  lines: readonly { productId: string; quantity: number; unitCost: number }[],
  day: string,
  orderId: string,
  actor: StockActor,
): Promise<number> {
  if (lines.length === 0) return 0;
  const recipeRows = await tx.recipeLine.findMany({
    where: { productId: { in: [...new Set(lines.map((line) => line.productId))] } },
    orderBy: { position: "asc" },
  });
  if (recipeRows.length === 0) return 0;
  const stock = await lockStock(
    tx,
    recipeRows.map((row) => row.ingredientId),
  );

  let restored = 0;
  for (const line of lines) {
    const recipe = recipeRows.filter((row) => row.productId === line.productId);
    if (recipe.length === 0) continue;
    const total = line.unitCost * line.quantity;
    const values = allocate(
      total,
      recipe.map((row) => row.quantity * Math.max(stock.get(row.ingredientId)?.averageCost ?? 0, 1)),
    );
    for (const [index, row] of recipe.entries()) {
      const current = stock.get(row.ingredientId);
      const quantity = roundQuantity(row.quantity * line.quantity);
      if (!current || quantity === 0) continue;
      const movement = {
        kind: "return" as const,
        quantity,
        value: values[index],
        date: day,
        referenceId: orderId,
        // The refund puts its units back on the shelf itself.
        shelfMoved: true,
      };
      stock.set(
        row.ingredientId,
        await writeMovement(tx, current, receiveStock(current, quantity, values[index]), movement, actor),
      );
      restored += values[index];
    }
  }
  return restored;
}
