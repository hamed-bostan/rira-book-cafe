import type {
  BankMatchInput,
  BankStatementFormInput,
  RecordStatementLineInput,
  StatementLinesInput,
} from "@/src/contracts/bank-schema";
import type { BankStatement } from "@/src/domain/entities/BankReconciliation";
import type { JournalEntry } from "@/src/domain/entities/Ledger";
import { apiDelete, apiPost } from "@/src/lib/api/client";
import { journalEntryResponseSchema } from "@/src/presentation/dashboard/accounting/accounting-response-schema";

import { autoMatchResponseSchema, bankStatementResponseSchema } from "./bank-statement-response-schema";

const base = (id: string): string => `/admin/accounting/bank-statements/${encodeURIComponent(id)}`;

/**
 * Typed client for bank reconciliation writes. The routes re-validate with the
 * same schemas; callers `router.refresh()` (or navigate) after.
 */
export const bankStatementsApi = {
  /** 409 `STATEMENT_OVERLAP`; 400 `openingMustMatchPrevious` on `openingBalance`. */
  create(values: BankStatementFormInput): Promise<BankStatement> {
    return apiPost("/admin/accounting/bank-statements", values, bankStatementResponseSchema);
  },

  addLines(id: string, values: StatementLinesInput): Promise<BankStatement> {
    return apiPost(`${base(id)}/lines`, values, bankStatementResponseSchema);
  },

  removeLine(id: string, lineId: string): Promise<void> {
    return apiDelete(`${base(id)}/lines/${encodeURIComponent(lineId)}`);
  },

  /** 409 `MATCH_UNBALANCED` when the two sides don't total the same, `ALREADY_MATCHED` on a race. */
  match(id: string, values: BankMatchInput): Promise<void> {
    return apiPost(`${base(id)}/matches`, values);
  },

  unmatch(id: string, matchId: string): Promise<void> {
    return apiDelete(`${base(id)}/matches/${encodeURIComponent(matchId)}`);
  },

  async autoMatch(id: string): Promise<number> {
    return (await apiPost(`${base(id)}/auto-match`, {}, autoMatchResponseSchema)).matched;
  },

  /** Post a fee, interest or gateway payout from a statement line and match it. */
  recordLine(id: string, lineId: string, values: RecordStatementLineInput): Promise<JournalEntry> {
    return apiPost(`${base(id)}/lines/${encodeURIComponent(lineId)}/record`, values, journalEntryResponseSchema);
  },

  /** 409 `NOT_RECONCILED` / `PREVIOUS_NOT_RECONCILED`. */
  reconcile(id: string): Promise<BankStatement> {
    return apiPost(`${base(id)}/reconcile`, {}, bankStatementResponseSchema);
  },
};
