import { z } from "zod/mini";

import type { Floor } from "@/src/domain/entities/FloorAvailability";
import { RESERVATION_STATUSES } from "@/src/domain/entities/Reservation";

/** What `GET /api/admin/reservations/floor` returns, validated at the typed-service boundary. */
export const floorResponseSchema = z.object({
  bookings: z.array(
    z.object({
      id: z.string(),
      reference: z.number(),
      status: z.enum(RESERVATION_STATUSES),
      tableLabel: z.optional(z.string()),
      startsAt: z.string(),
      durationMinutes: z.number(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      tableLabels: z.array(z.string()),
    }),
  ),
}) satisfies z.ZodMiniType<Floor>;
