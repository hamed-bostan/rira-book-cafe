import type {
  OpeningStockFormInput,
  ReorderLevelInput,
  StockCountFormInput,
  StockReceiptFormInput,
  WasteFormInput,
} from "@/src/contracts/inventory-schema";
import type { Expense } from "@/src/domain/entities/Expense";
import type { JournalEntry } from "@/src/domain/entities/Ledger";
import { apiPatch, apiPost } from "@/src/lib/api/client";
import {
  expenseResponseSchema,
  journalEntryResponseSchema,
} from "@/src/presentation/dashboard/accounting/accounting-response-schema";

import { countResultResponseSchema, openingResultResponseSchema } from "./inventory-response-schema";

/** Typed client for stock writes; each posts its journal entries server-side. Callers refresh or navigate after. */
export const inventoryApi = {
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
};

export const fiscalYearsApi = {
  close(year: number): Promise<JournalEntry> {
    return apiPost("/admin/accounting/year-close", { year }, journalEntryResponseSchema);
  },
};
