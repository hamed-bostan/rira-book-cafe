import { describe, expect, it } from "vitest";

import { orderNoteListResponseSchema } from "../order-note-response-schema";

describe("orderNoteListResponseSchema", () => {
  const NOTE = {
    id: "n1",
    orderId: "o1",
    authorId: "u1",
    authorName: "Hamed",
    body: "Packed",
    createdAt: "2026-10-17T10:00:00.000Z",
  };

  it("reads the notes the endpoint returns", () => {
    expect(orderNoteListResponseSchema.parse([NOTE])).toEqual([NOTE]);
  });

  it("rejects a note missing its author", () => {
    const { authorName: _authorName, ...withoutAuthor } = NOTE;
    expect(orderNoteListResponseSchema.safeParse([withoutAuthor]).error?.issues[0]?.path).toEqual([0, "authorName"]);
  });
});
