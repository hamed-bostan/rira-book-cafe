import { serverApiGet } from "@/src/lib/api/server-client";

import { cashShiftOverviewResponseSchema, type CashShiftOverview } from "./cash-shift-response-schema";

/** Server-side till reads for the dashboard (BFF), fetched during server render. */
export const cashShiftsServerApi = {
  /** The open shift with its figures so far, and past shifts. */
  overview(): Promise<CashShiftOverview> {
    return serverApiGet("/admin/cash-shifts", cashShiftOverviewResponseSchema);
  },
};
