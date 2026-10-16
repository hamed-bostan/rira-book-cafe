import { z } from "zod";

import { isCafeDay } from "@/src/domain/entities/CafeTime";
import {
  MAX_SUITE_GUESTS,
  MAX_SUITE_NOTE_LENGTH,
  MIN_SUITE_GUESTS,
  SUITE_BOOKING_STATUSES,
} from "@/src/domain/entities/SuiteBooking";

/**
 * Suite-booking contracts shared by the route handlers and their clients. Days
 * travel as cafe days (`YYYY-MM-DD`, what a `date` input holds). Messages are
 * `formErrors` keys.
 */

/** A guest asking for the suite. */
export const requestSuiteBookingSchema = z
  .object({
    checkIn: z.string().refine(isCafeDay, "dateInvalid"),
    checkOut: z.string().refine(isCafeDay, "dateInvalid"),
    guests: z.number().int("suiteGuestsInvalid").min(MIN_SUITE_GUESTS, "suiteGuestsInvalid").max(MAX_SUITE_GUESTS, "suiteGuestsInvalid"),
    note: z
      .string()
      .trim()
      .max(MAX_SUITE_NOTE_LENGTH, "noteTooLong")
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine((data) => data.checkOut > data.checkIn, { message: "checkOutBeforeCheckIn", path: ["checkOut"] });

export type RequestSuiteBookingInput = z.input<typeof requestSuiteBookingSchema>;

/** Staff moving a stay along. */
export const suiteBookingUpdateSchema = z.object({
  status: z.enum(SUITE_BOOKING_STATUSES, { message: "statusInvalid" }),
});

export type SuiteBookingUpdateInput = z.input<typeof suiteBookingUpdateSchema>;
