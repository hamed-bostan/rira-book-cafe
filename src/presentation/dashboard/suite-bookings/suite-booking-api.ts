import type { StaffSuiteBookingInput, SuiteBookingUpdateInput } from "@/src/contracts/suite-booking-schema";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { apiPatch, apiPost } from "@/src/lib/api/client";
import { suiteBookingResponseSchema } from "@/src/presentation/suite-bookings/suite-booking-response-schema";

/** Typed client for the dashboard's suite mutations; components `router.refresh()` after. */
export const suiteBookingsApi = {
  /** Book a guest who rang or asked at the counter; confirmed at once. 409 `SUITE_TAKEN` for nights already held. */
  create(values: StaffSuiteBookingInput): Promise<SuiteBooking> {
    return apiPost("/admin/suite-bookings", values, suiteBookingResponseSchema);
  },

  /** Move a stay along, or take back a Check in (`undo`). 409 for a refused transition, or `SUITE_TAKEN` for nights already held. */
  update(id: string, values: SuiteBookingUpdateInput): Promise<SuiteBooking> {
    return apiPatch(`/admin/suite-bookings/${id}`, values, suiteBookingResponseSchema);
  },
};
