import { z } from "zod/mini";

import { NOTIFICATION_KINDS, type Notification } from "@/src/domain/entities/Notification";

/** What the notification endpoints return, validated at the typed-service boundary. */
export const notificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  link: z.optional(z.string()),
  readAt: z.optional(z.string()),
  createdAt: z.string(),
}) satisfies z.ZodMiniType<Notification>;

export const notificationListResponseSchema = z.array(notificationResponseSchema);

export const unreadCountResponseSchema = z.object({ count: z.number() });
