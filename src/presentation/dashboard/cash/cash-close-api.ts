import type { CashCloseFormInput } from "@/src/contracts/cash-schema";
import type { CashClose } from "@/src/domain/entities/CashClose";
import { apiPost } from "@/src/lib/api/client";

import { cashCloseResponseSchema } from "./cash-close-response-schema";

/** Typed client for closing the till. The route re-validates with the same schema; callers `router.refresh()` after. */
export const cashClosesApi = {
  /** 409 `DAY_ALREADY_CLOSED`, `CLOSE_OUT_OF_ORDER`, or `CASH_CHANGED` when the books moved since the expected amount was shown. */
  create(values: CashCloseFormInput): Promise<CashClose> {
    return apiPost("/admin/cash/closes", values, cashCloseResponseSchema);
  },
};
