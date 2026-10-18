import { describe, expect, it } from "vitest";

import { MAX_ORDER_NOTE_LENGTH } from "@/src/domain/entities/OrderNote";

import { orderNoteListResponseSchema, orderNoteSchema } from "../order-note-schema";

describe("orderNoteSchema", () => {
  it("trims the body", () => {
    expect(orderNoteSchema.parse({ body: " Called the guest about the oat milk " })).toEqual({
      body: "Called the guest about the oat milk",
    });
  });

  it("requires a body within the cap", () => {
    expect(orderNoteSchema.safeParse({ body: "   " }).error?.flatten().fieldErrors.body).toEqual(["noteRequired"]);
    expect(orderNoteSchema.safeParse({ body: "n".repeat(MAX_ORDER_NOTE_LENGTH) }).success).toBe(true);
    expect(
      orderNoteSchema.safeParse({ body: "n".repeat(MAX_ORDER_NOTE_LENGTH + 1) }).error?.flatten().fieldErrors.body,
    ).toEqual(["noteTooLong"]);
  });
});

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
