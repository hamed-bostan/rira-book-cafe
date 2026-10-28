import { z } from "zod/mini";

/** What the order-notes endpoint returns: the note as written, with its assigned id and time. */
export const orderNoteResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const orderNoteListResponseSchema = z.array(orderNoteResponseSchema);
