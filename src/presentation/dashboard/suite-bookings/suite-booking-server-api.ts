import type { SuiteBooking, SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { serverApiGet } from "@/src/lib/api/server-client";
import { suiteBookingListResponseSchema } from "@/src/presentation/suite-bookings/suite-booking-response-schema";

/** Server-side suite reads for the dashboard (BFF), fetched during server render. */
export const suiteBookingsServerApi = {
  /** Stays that end after `from` (cafe day), in check-in order. */
  listFrom(from: string, status?: SuiteBookingStatus): Promise<SuiteBooking[]> {
    return serverApiGet("/admin/suite-bookings", suiteBookingListResponseSchema, {
      params: status ? { from, status } : { from },
    });
  },
};
