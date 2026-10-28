import { z } from "zod/mini";

import { WAITLIST_STATUSES, type BookWaitlistEntry, type BookWaitlistStatus } from "@/src/domain/entities/BookWaitlist";

/** What the waitlist endpoints return, validated at the typed-service boundary. */
export const bookWaitlistEntryResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  bookTitle: z.string(),
  userId: z.optional(z.string()),
  guestName: z.string(),
  guestPhone: z.string(),
  status: z.enum(WAITLIST_STATUSES),
  notifiedAt: z.optional(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<BookWaitlistEntry>;

export const bookWaitlistEntryListResponseSchema = z.array(bookWaitlistEntryResponseSchema);

export const bookWaitlistStatusResponseSchema = z.object({
  onLoan: z.number(),
  queueLength: z.number(),
  entry: z.nullable(bookWaitlistEntryResponseSchema),
  position: z.nullable(z.number()),
}) satisfies z.ZodMiniType<BookWaitlistStatus>;
