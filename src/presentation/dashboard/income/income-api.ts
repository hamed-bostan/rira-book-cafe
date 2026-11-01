import type { IncomeFormInput } from "@/src/contracts/income-schema";
import type { Income } from "@/src/domain/entities/Income";
import { apiPost } from "@/src/lib/api/client";

import { incomeResponseSchema } from "./income-response-schema";

/** Typed client for income writes; each books its journal entry server-side. */
export const incomesApi = {
  create(values: IncomeFormInput): Promise<Income> {
    return apiPost("/admin/income", values, incomeResponseSchema);
  },

  /** Reverses what it posted, dated today. */
  void(id: string, reason: string): Promise<Income> {
    return apiPost(`/admin/income/${id}/void`, { reason }, incomeResponseSchema);
  },
};
