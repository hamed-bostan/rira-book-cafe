import { randomUUID } from "node:crypto";

import type { Expense } from "@/src/domain/entities/Expense";
import {
  ADJUSTMENT_REASONS,
  issueStock,
  onHandAtEndOf,
  openingLinesRefused,
  receiveStock,
  roundQuantity,
  settleSupplierCredit,
  STOCK_MOVEMENT_KINDS,
  stockLevel,
  withRunningBalance,
  type AdjustmentReason,
  type StockItem,
  type StockMovement,
  type StockMovementKind,
  type StockState,
  type SupplierReturn,
  type SupplierReturnLine,
} from "@/src/domain/entities/Inventory";
import { SYSTEM_ACCOUNTS, type NewJournalEntry } from "@/src/domain/entities/Ledger";
import { ACTIVE_ORDER_STATUSES } from "@/src/domain/entities/Order";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { INGREDIENT_UNITS, type IngredientUnit } from "@/src/domain/entities/Pricing";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { ValidationError } from "@/src/domain/errors/ValidationError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import {
  MAX_MOVEMENT_EXPORT_ROWS,
  MAX_RETURNABLE_DELIVERIES,
  type ReturnableDelivery,
  type IInventoryRepository,
  type MovementFilters,
  type OpeningStockInput,
  type StockAdjustmentInput,
  type StockChange,
  type StockCountInput,
  type StockLedgerHook,
  type StockReceiptInput,
  type SupplierReturnInput,
  type SupplierReturnPosting,
  type UntrackedBook,
  type WasteInput,
} from "@/src/domain/repositories/IInventoryRepository";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { PrismaExpenseRepository } from "./PrismaExpenseRepository";
import { recostProductsUsing, toPurchaseUnits } from "./PrismaPricingRepository";
import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, postEntry } from "./writeJournal";
import { lockStock, writeMovement, type LockedStock, type StockActor } from "./writeStock";

/** A supplier's or a delivery's returns, newest first — far more than a screen shows. */
const MAX_RETURNS_LISTED = 200;

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
      include: { _count: { select: { stockMovements: true } }, supplier: { select: { name: true } } },
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
        parLevel: row.parLevel ?? undefined,
        purchaseUnits: toPurchaseUnits(row.purchaseUnits),
        supplierId: row.supplierId ?? undefined,
        supplierName: row.supplier?.name ?? undefined,
        lastPurchaseCost: row.purchaseQuantity > 0 ? Number(row.purchasePrice) / row.purchaseQuantity : 0,
        isActive: row.isActive,
        level: stockLevel({ onHand: row.onHand, reorderLevel }),
        hasHistory: row._count.stockMovements > 0,
      };
    });
  }

  async listMovements(filters: MovementFilters, page: PageRequest): Promise<Page<StockMovement>> {
    const where = movementWhere(filters);
    const { skip, take } = toSkipTake(page);
    const [rows, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({ where, orderBy: NEWEST_FIRST, skip, take, include: WITH_NAME }),
      prisma.stockMovement.count({ where }),
    ]);
    const movements = rows.map(toMovement);
    if (!filters.ingredientId || movements.length === 0) return createPage(movements, total, page);

    // Each row's running balance: on hand now, less everything that moved after it
    // (by date, then entry time, then id — the list's own order), over all of the
    // item's movements whatever the filters hide.
    const [item, newer] = await Promise.all([
      prisma.ingredient.findUnique({ where: { id: filters.ingredientId }, select: { onHand: true } }),
      prisma.$queryRaw<{ id: string; newer: number }[]>`
        SELECT m.id, COALESCE((
          SELECT SUM(o.quantity) FROM stock_movements o
          WHERE o.ingredient_id = m.ingredient_id AND (o.date, o.created_at, o.id) > (m.date, m.created_at, m.id)
        ), 0)::float8 AS newer
        FROM stock_movements m WHERE m.id IN (${Prisma.join(movements.map((movement) => movement.id))})`,
    ]);
    const onHand = item?.onHand ?? 0;
    const after = new Map(newer.map((row) => [row.id, onHandAtEndOf(onHand, row.newer)]));
    return createPage(
      movements.map((movement) => ({ ...movement, balanceAfter: after.get(movement.id) })),
      total,
      page,
    );
  }

  async exportMovements(filters: MovementFilters): Promise<StockMovement[]> {
    const rows = await prisma.stockMovement.findMany({
      where: movementWhere(filters),
      orderBy: NEWEST_FIRST,
      take: MAX_MOVEMENT_EXPORT_ROWS,
      include: WITH_NAME,
    });
    const movements = rows.map(toMovement);
    // One item, every kind: the rows are a contiguous stretch of its history, so the
    // balance walks back from the newest one's. With a kind filter, rows are missing
    // in between, so the file carries no balance rather than a wrong one.
    if (filters.ingredientId && !filters.kind && movements.length > 0) {
      const newest = rows[0];
      const [item, newer] = await Promise.all([
        prisma.ingredient.findUnique({ where: { id: filters.ingredientId }, select: { onHand: true } }),
        prisma.$queryRaw<{ newer: number }[]>`
          SELECT COALESCE(SUM(o.quantity), 0)::float8 AS newer
          FROM stock_movements o, stock_movements n
          WHERE n.id = ${newest.id} AND o.ingredient_id = n.ingredient_id
            AND (o.date, o.created_at, o.id) > (n.date, n.created_at, n.id)`,
      ]);
      const latest = onHandAtEndOf(item?.onHand ?? 0, newer[0]?.newer ?? 0);
      return withRunningBalance(movements, latest).reverse();
    }
    return movements.reverse();
  }

  async onHandAt(day: string): Promise<Map<string, number>> {
    const [items, since] = await Promise.all([
      prisma.ingredient.findMany({ select: { id: true, onHand: true } }),
      prisma.stockMovement.groupBy({
        by: ["ingredientId"],
        where: { date: { gt: dayToDate(day) } },
        _sum: { quantity: true },
      }),
    ]);
    const moved = new Map(since.map((row) => [row.ingredientId, row._sum.quantity ?? 0]));
    return new Map(items.map((item) => [item.id, onHandAtEndOf(item.onHand, moved.get(item.id) ?? 0)]));
  }

  async setReorderLevel(
    ingredientId: string,
    reorderLevel: number | null,
    audit?: AuditHook<{ id: string; name: string; before: number | null; after: number | null }>,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const row = await tx.ingredient.findUnique({
        where: { id: ingredientId },
        select: { name: true, reorderLevel: true, parLevel: true },
      });
      if (!row) throw new NotFoundError("stock item", ingredientId);
      if (reorderLevel !== null && row.parLevel !== null && row.parLevel < reorderLevel)
        throw new ValidationError("reorderLevel", "reorderAbovePar");
      await tx.ingredient.update({ where: { id: ingredientId }, data: { reorderLevel } });
      await recordAudit(tx, { id: ingredientId, name: row.name, before: row.reorderLevel, after: reorderLevel }, audit);
    });
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
            note: line.note,
          },
          actor,
        );
        // The latest price paid is what the pricing advisor costs recipes at. A line
        // that came free (a supplier's sample, a bonus case) says nothing about the
        // price: it only lowers the average cost, as the free units above already did.
        if (line.cost > 0) {
          await tx.ingredient.update({
            where: { id: line.ingredientId },
            data: { purchasePrice: BigInt(line.cost), purchaseQuantity: line.quantity },
          });
        }
      }
      // Every line moves the average cost recipes are costed at, a free one too.
      await recostProductsUsing(
        tx,
        lines.map((line) => line.ingredientId),
      );
      return expense;
    });
  }

  async recordWaste(
    input: WasteInput,
    ledger: StockLedgerHook,
    actor: StockActor,
    audit?: AuditHook<StockChange>,
  ): Promise<StockMovement> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const stock = await lockAll(tx, [input.ingredientId]);
      const current = stock.get(input.ingredientId) as LockedStock;
      const { state, value } = issueStock(current, input.quantity);
      await moveAndAudit(
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
        audit,
      );
      await recostProductsUsing(tx, [current.id], { refuse: false });
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
    audit?: AuditHook<StockChange>,
  ): Promise<{ id: string; variance: number; adjusted: number }> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const ids = input.lines.map((line) => line.ingredientId);
      const stock = await lockAll(tx, ids);
      // What moved after the count's day, read under the locks: a backdated count is
      // compared with what was on hand then (see CountStock).
      const since = await tx.stockMovement.groupBy({
        by: ["ingredientId"],
        where: { ingredientId: { in: ids }, date: { gt: dayToDate(input.date) } },
        _sum: { quantity: true },
      });
      const movedSince = new Map(since.map((row) => [row.ingredientId, row._sum.quantity ?? 0]));
      let variance = 0;
      let adjusted = 0;
      for (const line of input.lines) {
        const current = stock.get(line.ingredientId) as LockedStock;
        const expected = onHandAtEndOf(current.onHand, movedSince.get(line.ingredientId) ?? 0);
        const difference = roundQuantity(line.counted - expected);
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
        await moveAndAudit(
          tx,
          current,
          next,
          { kind: "count", quantity: difference, value, date: input.date, referenceId: id, note: input.note },
          actor,
          audit,
        );
        variance += value;
        adjusted += 1;
      }
      await recostProductsUsing(tx, ids, { refuse: false });
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
    audit?: AuditHook<StockChange>,
  ): Promise<{ id: string; value: number }> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const lines = mergeLines(input.lines);
      const stock = await lockAll(
        tx,
        lines.map((line) => line.ingredientId),
      );
      // Read under the rows' locks, so two openings for one item can't both pass.
      const moved = await tx.stockMovement.findMany({
        where: { ingredientId: { in: lines.map((line) => line.ingredientId) } },
        distinct: ["ingredientId"],
        select: { ingredientId: true },
      });
      const refused = openingLinesRefused(input.lines, new Set(moved.map((row) => row.ingredientId)));
      if (refused.length > 0) {
        const names = [...new Set(refused.map((index) => stock.get(input.lines[index].ingredientId)?.name))];
        throw new ConflictError(
          "STOCK_HAS_HISTORY",
          `${names.join(", ")} already ${names.length === 1 ? "has" : "have"} stock history — record a delivery or a count instead.`,
          { fields: refused.map((index) => `lines.${index}.ingredientId`) },
        );
      }
      for (const line of lines) {
        const current = stock.get(line.ingredientId) as LockedStock;
        await moveAndAudit(
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
          audit,
        );
      }
      await recostProductsUsing(
        tx,
        lines.map((line) => line.ingredientId),
        { refuse: false },
      );
      const value = lines.reduce((sum, line) => sum + line.cost, 0);
      const entry = value > 0 ? ledger({ id, date: input.date, value, description: "Opening stock" }) : null;
      if (entry) await postEntry(tx, entry);
      return { id, value };
    });
  }

  async adjust(
    input: StockAdjustmentInput,
    ledger: StockLedgerHook,
    actor: StockActor,
    audit?: AuditHook<StockChange>,
  ): Promise<StockMovement> {
    return prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const stock = await lockAll(tx, [input.ingredientId]);
      const current = stock.get(input.ingredientId) as LockedStock;
      let next: StockState;
      let value: number;
      if (input.quantity < 0) {
        const issued = issueStock(current, -input.quantity);
        next = issued.state;
        value = -issued.value;
      } else {
        // Stock coming in by hand is valued at the going average cost, as a count's surplus is.
        value = Math.round(current.averageCost * input.quantity);
        next = {
          onHand: roundQuantity(current.onHand + input.quantity),
          value: current.value + value,
          averageCost: current.averageCost,
        };
      }
      const movement = {
        kind: "adjustment" as const,
        quantity: input.quantity,
        value,
        date: input.date,
        referenceId: id,
        note: input.note,
        reason: input.reason,
      };
      await moveAndAudit(tx, current, next, movement, actor, audit);
      await recostProductsUsing(tx, [current.id], { refuse: false });
      const entry = ledger({
        id,
        date: input.date,
        value,
        description: `Stock adjustment (${input.reason}): ${input.quantity} ${current.name}${
          input.note ? ` — ${input.note}` : ""
        }`,
      });
      if (entry) await postEntry(tx, entry);
      return {
        id,
        ingredientId: current.id,
        ingredientName: current.name,
        ...movement,
        createdByName: actor.name,
        createdAt: new Date().toISOString(),
      };
    });
  }

  async returnToSupplier(
    input: SupplierReturnInput,
    ledger: (posting: SupplierReturnPosting) => NewJournalEntry,
    actor: StockActor,
    audit?: AuditHook<StockChange>,
  ): Promise<SupplierReturn> {
    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier) throw new ValidationError("supplierId", "That supplier no longer exists.");

      // The delivery whose bill takes the credit: this supplier's, for stock, standing.
      let owed = 0;
      let bill: { id: string; number: number; paidAmount: bigint; amount: bigint } | null = null;
      if (input.expenseId) {
        const row = await tx.expense.findUnique({ where: { id: input.expenseId } });
        if (
          !row ||
          row.status === "void" ||
          row.supplierId !== input.supplierId ||
          row.accountCode !== SYSTEM_ACCOUNTS.inventory
        )
          throw new ValidationError("expenseId", "returnDeliveryInvalid");
        if (input.date < dateToDay(row.date)) throw new ValidationError("date", "returnBeforeDelivery");
        bill = row;
        owed = row.status === "unpaid" ? Number(row.amount - row.paidAmount) : 0;
      }

      const ids = input.lines.map((line) => line.ingredientId);
      const stock = await lockAll(tx, ids);
      const over = input.lines.flatMap((line, index) =>
        line.quantity > (stock.get(line.ingredientId)?.onHand ?? 0) + 1e-9 ? [index] : [],
      );
      if (over.length > 0) {
        const names = over.map((index) => stock.get(input.lines[index].ingredientId)?.name).join(", ");
        throw new ConflictError("RETURN_EXCEEDS_STOCK", `There isn't that much ${names} on hand to send back.`, {
          fields: over.map((index) => `lines.${index}.quantity`),
        });
      }

      const { applied, refunded } = settleSupplierCredit(input.creditAmount, owed);
      if (refunded > 0 && !input.refundTo) throw new ValidationError("refundTo", "refundToRequired");
      const refundedTo = refunded > 0 ? input.refundTo : undefined;

      if (bill && applied > 0) {
        const paidAmount = bill.paidAmount + BigInt(applied);
        const settled = paidAmount >= bill.amount;
        // Guarded on what had been paid, as a payment is: a payment landing meanwhile
        // can't be overwritten.
        const result = await tx.expense.updateMany({
          where: { id: bill.id, status: "unpaid", paidAmount: bill.paidAmount },
          data: { paidAmount, ...(settled ? { status: "paid", paidOn: dayToDate(input.date) } : {}) },
        });
        if (result.count === 0)
          throw new ConflictError("INVALID_TRANSITION", "This delivery's bill was paid or changed meanwhile.");
      }

      const record = await tx.supplierReturn.create({
        data: {
          date: dayToDate(input.date),
          supplierId: supplier.id,
          supplierName: supplier.name,
          expenseId: bill?.id ?? null,
          creditAmount: BigInt(input.creditAmount),
          vatAmount: BigInt(input.vatAmount),
          appliedAmount: BigInt(applied),
          refundedAmount: BigInt(refunded),
          refundedTo: refundedTo ?? null,
          stockValue: BigInt(0),
          note: input.note ?? null,
          createdById: actor.id,
          createdByName: actor.name,
        },
      });

      let stockValue = 0;
      const lines: SupplierReturnLine[] = [];
      for (const line of input.lines) {
        const current = stock.get(line.ingredientId) as LockedStock;
        const { state, value } = issueStock(current, line.quantity);
        stock.set(
          current.id,
          await moveAndAudit(
            tx,
            current,
            state,
            {
              kind: "return_to_supplier",
              quantity: -line.quantity,
              value: -value,
              date: input.date,
              referenceId: record.id,
              note: `SR-${record.number} · ${supplier.name}`,
            },
            actor,
            audit,
          ),
        );
        stockValue += value;
        lines.push({ ingredientId: current.id, ingredientName: current.name, quantity: line.quantity, value });
      }
      await tx.supplierReturn.update({ where: { id: record.id }, data: { stockValue: BigInt(stockValue) } });
      await recostProductsUsing(tx, ids, { refuse: false });

      await postEntry(
        tx,
        ledger({
          id: record.id,
          number: record.number,
          date: input.date,
          supplierName: supplier.name,
          applied,
          refunded,
          refundedTo,
          vatAmount: input.vatAmount,
          stockValue,
          expenseNumber: bill?.number,
        }),
      );

      return {
        id: record.id,
        number: record.number,
        date: input.date,
        supplierId: supplier.id,
        supplierName: supplier.name,
        expenseId: bill?.id,
        expenseNumber: bill?.number,
        creditAmount: input.creditAmount,
        vatAmount: input.vatAmount,
        appliedAmount: applied,
        refundedAmount: refunded,
        refundedTo,
        stockValue,
        note: input.note,
        lines,
        createdByName: actor.name,
        createdAt: record.createdAt.toISOString(),
      };
    });
  }

  async listReturnableDeliveries(): Promise<ReturnableDelivery[]> {
    const rows = await prisma.expense.findMany({
      where: { accountCode: SYSTEM_ACCOUNTS.inventory, status: { not: "void" }, supplierId: { not: null } },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: MAX_RETURNABLE_DELIVERIES,
    });
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      date: dateToDay(row.date),
      supplierId: row.supplierId as string,
      description: row.description,
      amount: Number(row.amount),
      owed: row.status === "unpaid" ? Number(row.amount - row.paidAmount) : 0,
    }));
  }

  async listSupplierReturns(filter: { supplierId?: string; expenseId?: string }): Promise<SupplierReturn[]> {
    const rows = await prisma.supplierReturn.findMany({
      where: {
        ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
        ...(filter.expenseId ? { expenseId: filter.expenseId } : {}),
      },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: MAX_RETURNS_LISTED,
      include: { expense: { select: { number: true } } },
    });
    if (rows.length === 0) return [];
    const movements = await prisma.stockMovement.findMany({
      where: { referenceId: { in: rows.map((row) => row.id) }, kind: "return_to_supplier" },
      include: WITH_NAME,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      date: dateToDay(row.date),
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      expenseId: row.expenseId ?? undefined,
      expenseNumber: row.expense?.number,
      creditAmount: Number(row.creditAmount),
      vatAmount: Number(row.vatAmount),
      appliedAmount: Number(row.appliedAmount),
      refundedAmount: Number(row.refundedAmount),
      refundedTo: row.refundedTo === "cash" || row.refundedTo === "bank" ? row.refundedTo : undefined,
      stockValue: Number(row.stockValue),
      note: row.note ?? undefined,
      lines: movements
        .filter((movement) => movement.referenceId === row.id)
        .map((movement) => ({
          ingredientId: movement.ingredientId,
          ingredientName: movement.ingredient.name,
          quantity: -movement.quantity,
          value: -Number(movement.value),
        })),
      createdByName: row.createdByName,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listUntrackedBooks(): Promise<UntrackedBook[]> {
    const rows = await prisma.product.findMany({
      where: { kind: "book", bookAvailability: { not: "reading" }, recipeLines: { none: {} } },
      select: { id: true, name: true, costPrice: true, stockQuantity: true },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      costPrice: row.costPrice ?? undefined,
      stockQuantity: row.stockQuantity,
    }));
  }

  async trackBooks(
    books: readonly UntrackedBook[],
    date: string,
    ledger: StockLedgerHook,
    actor: StockActor,
  ): Promise<{ tracked: number; value: number }> {
    return prisma.$transaction(
      async (tx) => {
        const id = randomUUID();
        let tracked = 0;
        let value = 0;
        for (const book of books) {
          // Re-read under the transaction: someone may have given it a recipe since.
          if ((await tx.recipeLine.count({ where: { productId: book.id } })) > 0) continue;
          const cost = book.costPrice ?? 0;
          const item = await tx.ingredient.create({
            data: { name: book.name, unit: "piece", purchasePrice: BigInt(cost), purchaseQuantity: 1 },
          });
          await tx.recipeLine.create({
            data: { productId: book.id, ingredientId: item.id, quantity: 1, position: 0 },
          });
          tracked += 1;
          // Copies on the shelf include those open orders have taken off the sale
          // stock but not yet used up: completing those orders takes them out of
          // stock, so they come in now — or the two counts would part by them.
          const copies = (await tx.product.findUniqueOrThrow({ where: { id: book.id } })).stockQuantity;
          const onHand = copies + (await reservedCopies(tx, book.id));
          if (onHand > 0) {
            const lineValue = cost * onHand;
            const [current] = (await lockStock(tx, [item.id])).values();
            await writeMovement(
              tx,
              current,
              receiveStock(current, onHand, lineValue),
              // The sale stock already holds these copies.
              { kind: "opening", quantity: onHand, value: lineValue, date, referenceId: id, shelfMoved: true },
              actor,
            );
            value += lineValue;
          }
        }
        const entry = value > 0 ? ledger({ id, date, value, description: "Opening stock — books" }) : null;
        if (entry) await postEntry(tx, entry);
        return { tracked, value };
      },
      { timeout: TRACK_BOOKS_TIMEOUT_MS },
    );
  }
}

/** Long enough for a catalog's worth of titles in one transaction. */
const TRACK_BOOKS_TIMEOUT_MS = 60_000;

/** Units of an item that open orders (placed, not yet completed or cancelled) hold. */
async function reservedCopies(tx: Prisma.TransactionClient, productId: string): Promise<number> {
  const { _sum } = await tx.orderItem.aggregate({
    where: { productId, order: { status: { in: [...ACTIVE_ORDER_STATUSES] } } },
    _sum: { quantity: true },
  });
  return _sum.quantity ?? 0;
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

type MergedLine = { ingredientId: string; quantity: number; cost: number; note?: string };

/** One line per item, so a delivery listing beans twice is received once (its notes kept, joined). */
function mergeLines(lines: readonly MergedLine[]): MergedLine[] {
  const byId = new Map<string, MergedLine>();
  for (const line of lines) {
    const existing = byId.get(line.ingredientId);
    if (existing) {
      existing.quantity = roundQuantity(existing.quantity + line.quantity);
      existing.cost += line.cost;
      if (line.note) existing.note = existing.note ? `${existing.note}; ${line.note}` : line.note;
    } else
      byId.set(line.ingredientId, {
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        cost: line.cost,
        note: line.note,
      });
  }
  return [...byId.values()];
}

const NEWEST_FIRST: Prisma.StockMovementOrderByWithRelationInput[] = [
  { date: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];
const WITH_NAME = { ingredient: { select: { name: true } } } satisfies Prisma.StockMovementInclude;

function movementWhere(filters: MovementFilters): Prisma.StockMovementWhereInput {
  return {
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
}

function toMovement(row: Prisma.StockMovementGetPayload<{ include: typeof WITH_NAME }>): StockMovement {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredient.name,
    kind: toKind(row.kind),
    quantity: row.quantity,
    value: Number(row.value),
    date: dateToDay(row.date),
    referenceId: row.referenceId ?? undefined,
    note: row.note ?? undefined,
    reason: toReason(row.reason),
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

function toReason(value: string | null): AdjustmentReason | undefined {
  return value && (ADJUSTMENT_REASONS as readonly string[]).includes(value) ? (value as AdjustmentReason) : undefined;
}

/** Write one movement and, when the caller audits it, its activity entry — in the same transaction. */
async function moveAndAudit(
  tx: Prisma.TransactionClient,
  current: LockedStock,
  next: StockState,
  movement: Parameters<typeof writeMovement>[3] & { referenceId: string; reason?: AdjustmentReason },
  actor: StockActor,
  audit?: AuditHook<StockChange>,
): Promise<LockedStock> {
  const written = await writeMovement(tx, current, next, movement, actor);
  await recordAudit(
    tx,
    {
      ingredientId: current.id,
      ingredientName: current.name,
      kind: movement.kind,
      quantity: movement.quantity,
      onHandBefore: current.onHand,
      onHandAfter: next.onHand,
      value: movement.value,
      referenceId: movement.referenceId,
      reason: movement.reason,
      note: movement.note,
    },
    audit,
  );
  return written;
}

function toUnit(value: string): IngredientUnit {
  return (INGREDIENT_UNITS as readonly string[]).includes(value) ? (value as IngredientUnit) : "piece";
}

function toKind(value: string): StockMovementKind {
  return (STOCK_MOVEMENT_KINDS as readonly string[]).includes(value) ? (value as StockMovementKind) : "count";
}
