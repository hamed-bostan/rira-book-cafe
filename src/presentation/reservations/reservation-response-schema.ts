import { z } from "zod/mini";

import { RESERVATION_STATUSES, type Reservation } from "@/src/domain/entities/Reservation";
import { RESERVATION_DEPOSIT_METHODS, RESERVATION_DEPOSIT_STATES } from "@/src/domain/entities/ReservationDeposit";

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
  expiredAt: z.optional(z.string()),
  tableLabel: z.optional(z.string()),
  note: z.optional(z.string()),
  deposit: z.optional(
    z.object({
      amount: z.number(),
      method: z.enum(RESERVATION_DEPOSIT_METHODS),
      state: z.enum(RESERVATION_DEPOSIT_STATES),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<Reservation>;

export const reservationListResponseSchema = z.array(reservationResponseSchema);
