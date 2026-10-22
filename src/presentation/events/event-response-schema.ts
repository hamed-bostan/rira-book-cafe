import { z } from "zod";

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
  description: z.string().optional(),
  titleFa: z.string().optional(),
  descriptionFa: z.string().optional(),
  imageUrl: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().optional(),
  price: z.number(),
  isPublished: z.boolean(),
  seatsTaken: z.number(),
  tableLabels: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<CafeEvent>;

export const eventListResponseSchema = z.array(eventResponseSchema);

/** `GET /api/admin/events/:id/tables` — the floor as the "Hold tables" picker shows it. */
export const eventTableOptionListResponseSchema = z.array(
  z.object({
    label: z.string(),
    seats: z.number(),
    held: z.boolean(),
    clash: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("booking"), reference: z.number(), startsAt: z.string() }),
        z.object({ kind: z.literal("event"), eventId: z.string(), title: z.string() }),
      ])
      .optional(),
  }) satisfies z.ZodType<EventTableOption>,
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
}) satisfies z.ZodType<EventRegistration>;

export const eventRegistrationListResponseSchema = z.array(eventRegistrationResponseSchema);
