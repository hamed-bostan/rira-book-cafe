import type { BankStatementSummary } from "@/src/domain/entities/BankReconciliation";
import type { BankReconciliationView } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";

import { bankReconciliationResponseSchema, bankStatementListResponseSchema } from "./bank-statement-response-schema";

/** Server-side reads of bank statements for the dashboard (BFF), fetched during server render. */
export const bankStatementsServerApi = {
  list(): Promise<BankStatementSummary[]> {
    return serverApiGet("/admin/accounting/bank-statements", bankStatementListResponseSchema);
  },

  /** A statement with its candidates and reconciliation proof; `null` when it doesn't exist. */
  async getById(id: string): Promise<BankReconciliationView | null> {
    try {
      return await serverApiGet(
        `/admin/accounting/bank-statements/${encodeURIComponent(id)}`,
        bankReconciliationResponseSchema,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};
