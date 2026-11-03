import type { SuiteRateInput } from "@/src/contracts/booking-money-schema";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import type { SuiteSettings } from "@/src/domain/entities/SuitePricing";
import { apiPut } from "@/src/lib/api/client";
import { suiteBookingResponseSchema } from "@/src/presentation/suite-bookings/suite-booking-response-schema";

import { suiteSettingsResponseSchema } from "./suite-price-response-schema";

/** Typed client for the suite's price: what a night costs, and one stay's own rate. */
export const suitePricesApi = {
  /** What new stays are priced at; stays already made keep theirs. */
  updateDefault(values: SuiteRateInput): Promise<SuiteSettings> {
    return apiPut("/admin/suite-bookings/settings", values, suiteSettingsResponseSchema);
  },

  /** Price one stay at its own rate; its total follows. */
  updateStay(stayId: string, values: SuiteRateInput): Promise<SuiteBooking> {
    return apiPut(`/admin/suite-bookings/${stayId}/rate`, values, suiteBookingResponseSchema);
  },
};
