import type { SuiteBookingUpdateInput } from "@/src/contracts/suite-booking-schema";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { apiPatch } from "@/src/lib/api/client";
import { suiteBookingResponseSchema } from "@/src/presentation/suite-bookings/suite-booking-response-schema";

/** Typed client for the dashboard's suite mutations; components `router.refresh()` after. */
export const suiteBookingsApi = {
  /** Move a stay along. 409 for a refused transition, or `SUITE_TAKEN` for nights already held. */
  update(id: string, values: SuiteBookingUpdateInput): Promise<SuiteBooking> {
    return apiPatch(`/admin/suite-bookings/${id}`, values, suiteBookingResponseSchema);
  },
};
