import { randomUUID } from "node:crypto";

import { type Prisma } from "@prisma/client";

import type { Expense } from "@/src/domain/entities/Expense";
import {
  issueStock,
  receiveStock,
  roundQuantity,
  STOCK_MOVEMENT_KINDS,
  stockLevel,
  type StockItem,
  type StockMovement,
  type StockMovementKind,
} from "@/src/domain/entities/Inventory";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { INGREDIENT_UNITS, type IngredientUnit } from "@/src/domain/entities/Pricing";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { ValidationError } from "@/src/domain/errors/ValidationError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IInventoryRepository,
  MovementFilters,
  OpeningStockInput,
  StockCountInput,
  StockLedgerHook,
  StockReceiptInput,
  WasteInput,
} from "@/src/domain/repositories/IInventoryRepository";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { PrismaExpenseRepository } from "./PrismaExpenseRepository";
import { recostProductsUsing } from "./PrismaPricingRepository";
import { dateToDay, dayToDate, postEntry } from "./writeJournal";
import { lockStock, writeMovement, type LockedStock, type StockActor } from "./writeStock";

/**
 * Perpetual inventory in PostgreSQL. Every write locks the stock rows it touches,
 * records the movements, and posts the matching journal entry in the same
 * transaction — the Inventory account never drifts from the stock list.
 */
export class PrismaInventoryRepository implements IInventoryRepository {
  async listStock(includeInactive: boolean): Promise<StockItem[]> {
    const rows = await prisma.ingredient.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => {
      const reorderLevel = row.reorderLevel ?? undefined;
      return {
        id: row.id,
        name: row.name,
        unit: toUnit(row.unit),
        onHand: row.onHand,
        averageCost: row.averageCost,
        value: Number(row.stockValue),
        reorderLevel,
        isActive: row.isActive,
        level: stockLevel({ onHand: row.onHand, reorderLevel }),
      };
    });
  }

  async listMovements(filters: MovementFilters, page: PageRequest): Promise<Page<StockMovement>> {
    const where: Prisma.StockMovementWhereInput = {
      ...(filters.ingredientId ? { ingredientId: filters.ingredientId } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.fromDay || filters.toDay
        ? {
            date: {
              ...(filters.fromDay ? { gte: dayToDate(filters.fromDay) } : {}),
              ...(filters.toDay ? { lte: dayToDate(filters.toDay) } : {}),
            },
          }
        : {}),
    };
    const { skip, take } = toSkipTake(page);
    const [rows, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take,
        include: { ingredient: { select: { name: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return createPage(
      rows.map((row) => ({
        id: row.id,
        ingredientId: row.ingredientId,
        ingredientName: row.ingredient.name,
        kind: toKind(row.kind),
        quantity: row.quantity,
        value: Number(row.value),
        date: dateToDay(row.date),
        referenceId: row.referenceId ?? undefined,
        note: row.note ?? undefined,
        createdByName: row.createdByName,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
    );
  }

  async setReorderLevel(ingredientId: string, reorderLevel: number | null): Promise<void> {
    const result = await prisma.ingredient.updateMany({ where: { id: ingredientId }, data: { reorderLevel } });
    if (result.count === 0) throw new NotFoundError("stock item", ingredientId);
  }

  async receive(input: StockReceiptInput, ledger: LedgerHook<Expense>, audit?: AuditHook<Expense>): Promise<Expense> {
    return prisma.$transaction(async (tx) => {
      const lines = mergeLines(input.lines);
      const stock = await lockAll(
        tx,
        lines.map((line) => line.ingredientId),
      );
      const net = lines.reduce((sum, line) => sum + line.cost, 0);

      // The supplier bill, booked to Inventory with its VAT and payable (or payment).
      const expense = await new PrismaExpenseRepository(tx).create(
        {
          date: input.date,
          supplierId: input.supplierId,
          accountCode: "1200",
          description: input.description,
          amount: net + input.vatAmount,
          vatAmount: input.vatAmount,
          paidFrom: input.paidFrom,
          createdById: input.createdById,
          createdByName: input.createdByName,
        },
        ledger,
        audit,
      );

      const actor = { id: input.createdById, name: input.createdByName };
      for (const line of lines) {
        const current = stock.get(line.ingredientId) as LockedStock;
        await writeMovement(
          tx,
          current,
          receiveStock(current, line.quantity, line.cost),
          {
            kind: "receipt",
            quantity: line.quantity,
            value: line.cost,
            date: input.date,
            referenceId: expense.id,
          },
          actor,
        );
        // The latest price paid is what the pricing advisor costs recipes at.
        await tx.ingredient.update({
          where: { id: line.ingredientId },
          data: { purchasePrice: line.cost, purchaseQuantity: line.quantity },
        });
      }
      await recostProductsUsing(
        tx,
        lines.map((line) => line.ingredientId),
      );
      return expense;
    });
  }

  async recordWaste(input: WasteInput, ledger: StockLedgerHook, actor: StockActor): Promise<StockMovement> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const stock = await lockAll(tx, [input.ingredientId]);
      const current = stock.get(input.ingredientId) as LockedStock;
      const { state, value } = issueStock(current, input.quantity);
      await writeMovement(
        tx,
        current,
        state,
        {
          kind: "waste",
          quantity: -input.quantity,
          value: -value,
          date: input.date,
          referenceId: id,
          note: input.note,
        },
        actor,
      );
      const entry =
        value > 0
          ? ledger({
              id,
              date: input.date,
              value,
              description: `Waste: ${input.quantity} ${current.name}${input.note ? ` — ${input.note}` : ""}`,
            })
          : null;
      if (entry) await postEntry(tx, entry);
      return {
        id,
        ingredientId: current.id,
        ingredientName: current.name,
        kind: "waste",
        quantity: -input.quantity,
        value: -value,
        date: input.date,
        referenceId: id,
        note: input.note,
        createdByName: actor.name,
        createdAt: new Date().toISOString(),
      };
    });
  }

  async recordCount(
    input: StockCountInput,
    ledger: StockLedgerHook,
    actor: StockActor,
  ): Promise<{ id: string; variance: number; adjusted: number }> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const stock = await lockAll(
        tx,
        input.lines.map((line) => line.ingredientId),
      );
      let variance = 0;
      let adjusted = 0;
      for (const line of input.lines) {
        const current = stock.get(line.ingredientId) as LockedStock;
        const difference = roundQuantity(line.counted - current.onHand);
        if (difference === 0) continue;
        let next;
        let value;
        if (difference < 0) {
          const issued = issueStock(current, -difference);
          next = issued.state;
          value = -issued.value;
        } else {
          // Found stock is valued at the going average cost.
          value = Math.round(current.averageCost * difference);
          next = {
            onHand: roundQuantity(current.onHand + difference),
            value: current.value + value,
            averageCost: current.averageCost,
          };
        }
        await writeMovement(
          tx,
          current,
          next,
          { kind: "count", quantity: difference, value, date: input.date, referenceId: id, note: input.note },
          actor,
        );
        variance += value;
        adjusted += 1;
      }
      const entry = ledger({
        id,
        date: input.date,
        value: variance,
        description: `Stock count${input.note ? ` — ${input.note}` : ""}`,
      });
      if (entry) await postEntry(tx, entry);
      return { id, variance, adjusted };
    });
  }

  async recordOpening(
    input: OpeningStockInput,
    ledger: StockLedgerHook,
    actor: StockActor,
  ): Promise<{ id: string; value: number }> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const lines = mergeLines(input.lines);
      const stock = await lockAll(
        tx,
        lines.map((line) => line.ingredientId),
      );
      for (const line of lines) {
        const current = stock.get(line.ingredientId) as LockedStock;
        await writeMovement(
          tx,
          current,
          receiveStock(current, line.quantity, line.cost),
          {
            kind: "opening",
            quantity: line.quantity,
            value: line.cost,
            date: input.date,
            referenceId: id,
          },
          actor,
        );
      }
      const value = lines.reduce((sum, line) => sum + line.cost, 0);
      const entry = value > 0 ? ledger({ id, date: input.date, value, description: "Opening stock" }) : null;
      if (entry) await postEntry(tx, entry);
      return { id, value };
    });
  }
}

/** Lock the rows and make sure every item exists and is active. */
async function lockAll(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<Map<string, LockedStock>> {
  const stock = await lockStock(tx, ids);
  const rows = await tx.ingredient.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, isActive: true },
  });
  for (const id of new Set(ids)) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || !stock.has(id)) throw new NotFoundError("stock item", id);
    if (!row.isActive) throw new ValidationError("lines", `${stock.get(id)?.name ?? id} is switched off.`);
  }
  return stock;
}

/** One line per item, so a delivery listing beans twice is received once. */
function mergeLines<T extends { ingredientId: string; quantity: number; cost: number }>(
  lines: readonly T[],
): { ingredientId: string; quantity: number; cost: number }[] {
  const byId = new Map<string, { ingredientId: string; quantity: number; cost: number }>();
  for (const line of lines) {
    const existing = byId.get(line.ingredientId);
    if (existing) {
      existing.quantity = roundQuantity(existing.quantity + line.quantity);
      existing.cost += line.cost;
    } else byId.set(line.ingredientId, { ingredientId: line.ingredientId, quantity: line.quantity, cost: line.cost });
  }
  return [...byId.values()];
}

function toUnit(value: string): IngredientUnit {
  return (INGREDIENT_UNITS as readonly string[]).includes(value) ? (value as IngredientUnit) : "piece";
}

function toKind(value: string): StockMovementKind {
  return (STOCK_MOVEMENT_KINDS as readonly string[]).includes(value) ? (value as StockMovementKind) : "count";
}
