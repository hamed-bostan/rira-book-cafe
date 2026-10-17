import { z } from "zod";

import { NOTIFICATION_KINDS, type Notification } from "@/src/domain/entities/Notification";

/** What the notification endpoints return, validated at the typed-service boundary. */
export const notificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  params: z.record(z.union([z.string(), z.number()])),
  link: z.string().optional(),
  readAt: z.string().optional(),
  createdAt: z.string(),
}) satisfies z.ZodType<Notification>;

export const notificationListResponseSchema = z.array(notificationResponseSchema);

export const unreadCountResponseSchema = z.object({ count: z.number() });
