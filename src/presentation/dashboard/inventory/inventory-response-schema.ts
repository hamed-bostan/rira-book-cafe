import { z } from "zod";

import { STOCK_MOVEMENT_KINDS, type InventorySummary, type StockMovement } from "@/src/domain/entities/Inventory";
import type { Page } from "@/src/domain/entities/Pagination";
import { INGREDIENT_UNITS } from "@/src/domain/entities/Pricing";
import type { FiscalYearStatus } from "@/src/domain/use-cases/accounting/FiscalYearClose";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";

/** What the inventory endpoints return, checked at the BFF boundary. */

export const inventorySummaryResponseSchema: z.ZodType<InventorySummary> = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      unit: z.enum(INGREDIENT_UNITS),
      onHand: z.number(),
      averageCost: z.number(),
      value: z.number(),
      reorderLevel: z.number().optional(),
      isActive: z.boolean(),
      level: z.enum(["out", "low", "ok"]),
    }),
  ),
  lowCount: z.number(),
  outCount: z.number(),
  stockValue: z.number(),
  booksValue: z.number(),
  difference: z.number(),
  costsVisible: z.boolean(),
});

export const stockMovementResponseSchema: z.ZodType<StockMovement> = z.object({
  id: z.string(),
  ingredientId: z.string(),
  ingredientName: z.string(),
  kind: z.enum(STOCK_MOVEMENT_KINDS),
  quantity: z.number(),
  value: z.number(),
  date: z.string(),
  referenceId: z.string().optional(),
  note: z.string().optional(),
  createdByName: z.string(),
  createdAt: z.string(),
});
export const stockMovementPageResponseSchema: z.ZodType<Page<StockMovement>> = pageResponseSchema(stockMovementResponseSchema);

export const fiscalYearListResponseSchema: z.ZodType<FiscalYearStatus[]> = z.array(
  z.object({ year: z.number(), fromDay: z.string(), toDay: z.string(), ended: z.boolean(), closed: z.boolean() }),
);

export const countResultResponseSchema = z.object({ id: z.string(), variance: z.number(), adjusted: z.number() });
export const openingResultResponseSchema = z.object({ id: z.string(), value: z.number() });
