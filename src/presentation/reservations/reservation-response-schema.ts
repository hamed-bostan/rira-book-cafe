import { z } from "zod/mini";

import { RESERVATION_STATUSES, type Reservation } from "@/src/domain/entities/Reservation";

/** What the reservation endpoints return, validated at the typed-service boundary. */
export const reservationResponseSchema = z.object({
  id: z.string(),
  reference: z.number(),
  userId: z.optional(z.string()),
  guestName: z.string(),
  guestPhone: z.string(),
  partySize: z.number(),
  startsAt: z.string(),
  durationMinutes: z.number(),
  status: z.enum(RESERVATION_STATUSES),
  tableLabel: z.optional(z.string()),
  note: z.optional(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<Reservation>;

export const reservationListResponseSchema = z.array(reservationResponseSchema);
