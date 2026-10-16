import type { CashClose, CashCloseStatus, CashDayFigures } from "@/src/domain/entities/CashClose";
import type { Page } from "@/src/domain/entities/Pagination";
import { serverApiGet } from "@/src/lib/api/server-client";

import { cashClosePageResponseSchema, cashCloseStatusResponseSchema, cashDayResponseSchema } from "./cash-close-response-schema";

/** Server-side reads of the cash register for the dashboard (BFF), fetched during server render. */
export const cashClosesServerApi = {
  list(params: Record<string, string>): Promise<Page<CashClose>> {
    return serverApiGet("/admin/cash/closes", cashClosePageResponseSchema, { params });
  },

  getStatus(): Promise<CashCloseStatus> {
    return serverApiGet("/admin/cash/status", cashCloseStatusResponseSchema);
  },

  /** What the till should hold for a day — managers only (`accounting.view`). */
  getDay(day: string): Promise<CashDayFigures> {
    return serverApiGet(`/admin/cash/days/${day}`, cashDayResponseSchema);
  },
};
