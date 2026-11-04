import type {
  OpeningStockFormInput,
  ReorderLevelInput,
  StockAdjustmentFormInput,
  StockCountFormInput,
  StockItemFormInput,
  StockReceiptFormInput,
  SupplierReturnFormInput,
  WasteFormInput,
} from "@/src/contracts/inventory-schema";
import type { Expense } from "@/src/domain/entities/Expense";
import type { SupplierReturn } from "@/src/domain/entities/Inventory";
import type { JournalEntry } from "@/src/domain/entities/Ledger";
import { apiClient, apiPatch, apiPost, apiPut } from "@/src/lib/api/client";
import {
  expenseResponseSchema,
  journalEntryResponseSchema,
} from "@/src/presentation/dashboard/accounting/accounting-response-schema";

import {
  countResultResponseSchema,
  openingResultResponseSchema,
  stockItemSavedResponseSchema,
  supplierReturnResponseSchema,
  trackBooksResultResponseSchema,
} from "./inventory-response-schema";

/** Typed client for stock writes; each posts its journal entries server-side. Callers refresh or navigate after. */
export const inventoryApi = {
  /** Put every book for sale under stock. */
  trackBooks(): Promise<{ tracked: number; value: number }> {
    return apiPost("/admin/inventory/books", {}, trackBooksResultResponseSchema);
  },

  receive(values: StockReceiptFormInput): Promise<Expense> {
    return apiPost("/admin/inventory/receipts", values, expenseResponseSchema);
  },

  async recordWaste(values: WasteFormInput): Promise<void> {
    await apiPost("/admin/inventory/waste", values);
  },

  count(values: StockCountFormInput): Promise<{ id: string; variance: number; adjusted: number }> {
    return apiPost("/admin/inventory/counts", values, countResultResponseSchema);
  },

  recordOpening(values: OpeningStockFormInput): Promise<{ id: string; value: number }> {
    return apiPost("/admin/inventory/opening", values, openingResultResponseSchema);
  },

  setReorderLevel(id: string, values: ReorderLevelInput): Promise<void> {
    return apiPatch(`/admin/inventory/items/${id}`, values);
  },

  /** A manual ± with its reason. */
  async adjust(values: StockAdjustmentFormInput): Promise<void> {
    await apiPost("/admin/inventory/adjustments", values);
  },

  /** Stock going back to a supplier against their credit note. */
  returnToSupplier(values: SupplierReturnFormInput): Promise<SupplierReturn> {
    return apiPost("/admin/inventory/returns", values, supplierReturnResponseSchema);
  },
};

/** Stock items as Inventory makes and edits them. */
export const stockItemsApi = {
  create(values: StockItemFormInput): Promise<{ id: string; name: string }> {
    return apiPost("/admin/inventory/items", values, stockItemSavedResponseSchema);
  },

  update(id: string, values: StockItemFormInput): Promise<{ id: string; name: string }> {
    return apiPut(`/admin/inventory/items/${id}`, values, stockItemSavedResponseSchema);
  },
};

/** Download links: plain GETs the browser follows, so the session cookie goes with them. */
export const inventoryExports = {
  /** The movements the filters match, as a CSV in `locale`. */
  movementsHref(params: Record<string, string>): string {
    return apiClient.getUri({ url: "/admin/inventory/movements/export", params });
  },
};

export const fiscalYearsApi = {
  close(year: number): Promise<JournalEntry> {
    return apiPost("/admin/accounting/year-close", { year }, journalEntryResponseSchema);
  },
};
