import { z } from "zod";

import { MAX_ORDER_NOTE_LENGTH } from "@/src/domain/entities/OrderNote";

/**
 * The single source of truth for writing an internal note on an order, shared by
 * the dashboard's note form and the admin REST route (defensive re-validation —
 * never trust the client). Framework-free, so it stays importable from both.
 *
 * Only the body: the order comes from the URL and the author from the session,
 * because a note whose author the client could choose would be worthless as a
 * record of who knew what.
 */
export const orderNoteSchema = z.object({
  body: z.string().trim().min(1, "noteRequired").max(MAX_ORDER_NOTE_LENGTH, "noteTooLong"),
});

export type OrderNoteInput = z.infer<typeof orderNoteSchema>;

/** What the endpoint returns: the note as written, with its assigned id and time. */
export const orderNoteResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const orderNoteListResponseSchema = z.array(orderNoteResponseSchema);
