import { z } from "zod";

import {
  EVENT_KINDS,
  REGISTRATION_STATUSES,
  type CafeEvent,
  type EventRegistration,
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
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<CafeEvent>;

export const eventListResponseSchema = z.array(eventResponseSchema);

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
