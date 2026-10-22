import { z } from "zod";

import { SUITE_BOOKING_STATUSES, type SuiteBooking, type SuiteBusyRange } from "@/src/domain/entities/SuiteBooking";

/** What the suite-booking endpoints return, validated at the typed-service boundary. */
export const suiteBookingResponseSchema = z.object({
  id: z.string(),
  reference: z.number(),
  userId: z.string().optional(),
  guestName: z.string(),
  guestPhone: z.string(),
  guests: z.number(),
  checkIn: z.string(),
  checkOut: z.string(),
  status: z.enum(SUITE_BOOKING_STATUSES),
  note: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<SuiteBooking>;

export const suiteBookingListResponseSchema = z.array(suiteBookingResponseSchema);

export const suiteBusyListResponseSchema = z.array(
  z.object({ checkIn: z.string(), checkOut: z.string() }) satisfies z.ZodType<SuiteBusyRange>,
);
