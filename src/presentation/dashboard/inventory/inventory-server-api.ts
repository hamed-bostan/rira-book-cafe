import type { InventorySummary, StockMovement } from "@/src/domain/entities/Inventory";
import type { Page } from "@/src/domain/entities/Pagination";
import type { FiscalYearStatus } from "@/src/domain/use-cases/accounting/FiscalYearClose";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  fiscalYearListResponseSchema,
  inventorySummaryResponseSchema,
  stockMovementPageResponseSchema,
} from "./inventory-response-schema";

/** Server-side inventory reads for the dashboard (BFF), fetched during server render. */
export const inventoryServerApi = {
  getSummary(): Promise<InventorySummary> {
    return serverApiGet("/admin/inventory", inventorySummaryResponseSchema);
  },

  listMovements(params: Record<string, string>): Promise<Page<StockMovement>> {
    return serverApiGet("/admin/inventory/movements", stockMovementPageResponseSchema, { params });
  },
};

export const fiscalYearsServerApi = {
  list(): Promise<FiscalYearStatus[]> {
    return serverApiGet("/admin/accounting/year-close", fiscalYearListResponseSchema);
  },
};
