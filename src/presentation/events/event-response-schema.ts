import { z } from "zod/mini";

import {
  EVENT_KINDS,
  REGISTRATION_STATUSES,
  type CafeEvent,
  type EventRegistration,
  type EventTableOption,
} from "@/src/domain/entities/CafeEvent";

/** What the event endpoints return, validated at the typed-service boundary. */
export const eventResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(EVENT_KINDS),
  title: z.string(),
  description: z.optional(z.string()),
  titleFa: z.optional(z.string()),
  descriptionFa: z.optional(z.string()),
  imageUrl: z.optional(z.string()),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.optional(z.number()),
  price: z.number(),
  isPublished: z.boolean(),
  seatsTaken: z.number(),
  tableLabels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<CafeEvent>;

export const eventListResponseSchema = z.array(eventResponseSchema);

/** `GET /api/admin/events/:id/tables` — the floor as the "Hold tables" picker shows it. */
export const eventTableOptionListResponseSchema = z.array(
  z.object({
    label: z.string(),
    seats: z.number(),
    held: z.boolean(),
    clash: z.optional(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("booking"), reference: z.number(), startsAt: z.string() }),
        z.object({ kind: z.literal("event"), eventId: z.string(), title: z.string() }),
      ]),
    ),
  }) satisfies z.ZodMiniType<EventTableOption>,
);

export const eventRegistrationResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  guestName: z.string(),
  guestPhone: z.string(),
  seats: z.number(),
  status: z.enum(REGISTRATION_STATUSES),
  createdAt: z.string(),
}) satisfies z.ZodMiniType<EventRegistration>;

export const eventRegistrationListResponseSchema = z.array(eventRegistrationResponseSchema);
