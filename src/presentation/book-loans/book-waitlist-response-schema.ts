import { z } from "zod";

import { WAITLIST_STATUSES, type BookWaitlistEntry, type BookWaitlistStatus } from "@/src/domain/entities/BookWaitlist";

/** What the waitlist endpoints return, validated at the typed-service boundary. */
export const bookWaitlistEntryResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  bookTitle: z.string(),
  userId: z.string().optional(),
  guestName: z.string(),
  guestPhone: z.string(),
  status: z.enum(WAITLIST_STATUSES),
  notifiedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<BookWaitlistEntry>;

export const bookWaitlistEntryListResponseSchema = z.array(bookWaitlistEntryResponseSchema);

export const bookWaitlistStatusResponseSchema = z.object({
  onLoan: z.number(),
  queueLength: z.number(),
  entry: bookWaitlistEntryResponseSchema.nullable(),
  position: z.number().nullable(),
}) satisfies z.ZodType<BookWaitlistStatus>;
