import { describe, expect, it } from "vitest";

import { MAX_ORDER_NOTE_LENGTH } from "@/src/domain/entities/OrderNote";

import { orderNoteSchema } from "../order-note-schema";

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
