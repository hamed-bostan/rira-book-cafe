import type { CloseCashShiftInput, OpenCashShiftInput } from "@/src/contracts/cash-shift-schema";
import type { CashShift } from "@/src/domain/entities/CashShift";
import { apiPost } from "@/src/lib/api/client";

import { cashShiftResponseSchema } from "./cash-shift-response-schema";

/** Typed client for the till's shifts; components `router.refresh()` after. */
export const cashShiftsApi = {
  /** 409 `SHIFT_ALREADY_OPEN`. */
  open(values: OpenCashShiftInput): Promise<CashShift> {
    return apiPost("/admin/cash-shifts", values, cashShiftResponseSchema);
  },

  /** 409 `NO_OPEN_SHIFT` when it was closed meanwhile. */
  close(id: string, values: CloseCashShiftInput): Promise<CashShift> {
    return apiPost(`/admin/cash-shifts/${id}/close`, values, cashShiftResponseSchema);
  },
};
