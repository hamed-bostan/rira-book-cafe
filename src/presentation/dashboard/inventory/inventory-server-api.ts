import type { InventorySummary, StockMovement, SupplierReturn } from "@/src/domain/entities/Inventory";
import type { Page } from "@/src/domain/entities/Pagination";
import type { ReturnableDelivery, UntrackedBook } from "@/src/domain/repositories/IInventoryRepository";
import type { FiscalYearStatus } from "@/src/domain/use-cases/accounting/FiscalYearClose";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  fiscalYearListResponseSchema,
  inventorySummaryResponseSchema,
  onHandAtResponseSchema,
  returnableDeliveryListResponseSchema,
  stockMovementPageResponseSchema,
  supplierReturnListResponseSchema,
  untrackedBookListResponseSchema,
} from "./inventory-response-schema";

/** Server-side inventory reads for the dashboard (BFF), fetched during server render. */
export const inventoryServerApi = {
  getSummary(): Promise<InventorySummary> {
    return serverApiGet("/admin/inventory", inventorySummaryResponseSchema);
  },

  /** Books for sale that no stock item stands behind. */
  listUntrackedBooks(): Promise<UntrackedBook[]> {
    return serverApiGet("/admin/inventory/books", untrackedBookListResponseSchema);
  },

  listMovements(params: Record<string, string>): Promise<Page<StockMovement>> {
    return serverApiGet("/admin/inventory/movements", stockMovementPageResponseSchema, { params });
  },

  /** What each item had on hand at the end of `date`, by id — a backdated count's expected figures. */
  async getOnHandAt(date: string): Promise<Map<string, number>> {
    const result = await serverApiGet("/admin/inventory/on-hand", onHandAtResponseSchema, { params: { date } });
    return new Map(result.items.map((item) => [item.id, item.onHand]));
  },

  /** Stock sent back to suppliers, newest first; `supplier` or `expense` narrows it. */
  listReturns(params: Record<string, string> = {}): Promise<SupplierReturn[]> {
    return serverApiGet("/admin/inventory/returns", supplierReturnListResponseSchema, { params });
  },

  /** Recent deliveries a return can be made against. */
  listDeliveries(): Promise<ReturnableDelivery[]> {
    return serverApiGet("/admin/inventory/deliveries", returnableDeliveryListResponseSchema);
  },
};

export const fiscalYearsServerApi = {
  list(): Promise<FiscalYearStatus[]> {
    return serverApiGet("/admin/accounting/year-close", fiscalYearListResponseSchema);
  },
};
