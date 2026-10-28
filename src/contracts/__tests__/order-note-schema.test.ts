import { describe, expect, it } from "vitest";

import { MAX_ORDER_NOTE_LENGTH } from "@/src/domain/entities/OrderNote";

import { orderNoteSchema } from "../order-note-schema";

import { flattened } from "./zod-issues";

describe("orderNoteSchema", () => {
  it("trims the body", () => {
    expect(orderNoteSchema.parse({ body: " Called the guest about the oat milk " })).toEqual({
      body: "Called the guest about the oat milk",
    });
  });

  it("requires a body within the cap", () => {
    expect(flattened(orderNoteSchema.safeParse({ body: "   " }).error)?.fieldErrors.body).toEqual(["noteRequired"]);
    expect(orderNoteSchema.safeParse({ body: "n".repeat(MAX_ORDER_NOTE_LENGTH) }).success).toBe(true);
    expect(
      flattened(orderNoteSchema.safeParse({ body: "n".repeat(MAX_ORDER_NOTE_LENGTH + 1) }).error)?.fieldErrors.body,
    ).toEqual(["noteTooLong"]);
  });
});
