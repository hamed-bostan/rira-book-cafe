import { z } from "zod/mini";

import {
  ADJUSTMENT_REASONS,
  STOCK_MOVEMENT_KINDS,
  type InventorySummary,
  type StockMovement,
  type SupplierReturn,
} from "@/src/domain/entities/Inventory";
import type { Page } from "@/src/domain/entities/Pagination";
import { INGREDIENT_UNITS } from "@/src/domain/entities/Pricing";
import type { ReturnableDelivery, UntrackedBook } from "@/src/domain/repositories/IInventoryRepository";
import type { FiscalYearStatus } from "@/src/domain/use-cases/accounting/FiscalYearClose";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";

/** What the inventory endpoints return, checked at the BFF boundary. */

export const untrackedBookListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    costPrice: z.optional(z.number()),
    stockQuantity: z.number(),
  }) satisfies z.ZodMiniType<UntrackedBook>,
);

export const trackBooksResultResponseSchema = z.object({ tracked: z.number(), value: z.number() });

export const inventorySummaryResponseSchema: z.ZodMiniType<InventorySummary> = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      unit: z.enum(INGREDIENT_UNITS),
      onHand: z.number(),
      averageCost: z.number(),
      value: z.number(),
      reorderLevel: z.optional(z.number()),
      parLevel: z.optional(z.number()),
      purchaseUnits: z.array(z.object({ name: z.string(), factor: z.number() })),
      supplierId: z.optional(z.string()),
      supplierName: z.optional(z.string()),
      lastPurchaseCost: z.number(),
      isActive: z.boolean(),
      level: z.enum(["out", "low", "ok"]),
      hasHistory: z.boolean(),
    }),
  ),
  lowCount: z.number(),
  outCount: z.number(),
  stockValue: z.number(),
  booksValue: z.number(),
  difference: z.number(),
  costsVisible: z.boolean(),
});

export const stockMovementResponseSchema: z.ZodMiniType<StockMovement> = z.object({
  id: z.string(),
  ingredientId: z.string(),
  ingredientName: z.string(),
  kind: z.enum(STOCK_MOVEMENT_KINDS),
  quantity: z.number(),
  value: z.number(),
  date: z.string(),
  referenceId: z.optional(z.string()),
  note: z.optional(z.string()),
  reason: z.optional(z.enum(ADJUSTMENT_REASONS)),
  balanceAfter: z.optional(z.number()),
  createdByName: z.string(),
  createdAt: z.string(),
});
export const stockMovementPageResponseSchema: z.ZodMiniType<Page<StockMovement>> =
  pageResponseSchema(stockMovementResponseSchema);

export const supplierReturnResponseSchema: z.ZodMiniType<SupplierReturn> = z.object({
  id: z.string(),
  number: z.number(),
  date: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  expenseId: z.optional(z.string()),
  expenseNumber: z.optional(z.number()),
  creditAmount: z.number(),
  vatAmount: z.number(),
  appliedAmount: z.number(),
  refundedAmount: z.number(),
  refundedTo: z.optional(z.enum(["cash", "bank"])),
  stockValue: z.number(),
  note: z.optional(z.string()),
  lines: z.array(
    z.object({ ingredientId: z.string(), ingredientName: z.string(), quantity: z.number(), value: z.number() }),
  ),
  createdByName: z.string(),
  createdAt: z.string(),
});
export const supplierReturnListResponseSchema = z.array(supplierReturnResponseSchema);

export const returnableDeliveryListResponseSchema: z.ZodMiniType<ReturnableDelivery[]> = z.array(
  z.object({
    id: z.string(),
    number: z.number(),
    date: z.string(),
    supplierId: z.string(),
    description: z.string(),
    amount: z.number(),
    owed: z.number(),
  }),
);

/** What each item had on hand at the end of a day. */
export const onHandAtResponseSchema = z.object({
  date: z.string(),
  items: z.array(z.object({ id: z.string(), onHand: z.number() })),
});

export const stockItemSavedResponseSchema = z.object({ id: z.string(), name: z.string() });

export const fiscalYearListResponseSchema: z.ZodMiniType<FiscalYearStatus[]> = z.array(
  z.object({ year: z.number(), fromDay: z.string(), toDay: z.string(), ended: z.boolean(), closed: z.boolean() }),
);

export const countResultResponseSchema = z.object({ id: z.string(), variance: z.number(), adjusted: z.number() });
export const openingResultResponseSchema = z.object({ id: z.string(), value: z.number() });
