import { serverApiGet } from "@/src/lib/api/server-client";

import { incomePageResponseSchema, type IncomePageWire } from "./income-response-schema";

/** Server-side income reads for the dashboard (BFF). */
export const incomesServerApi = {
  list(params: Record<string, string>): Promise<IncomePageWire> {
    return serverApiGet("/admin/income", incomePageResponseSchema, { params });
  },
};
