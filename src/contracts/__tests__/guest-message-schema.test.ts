import { describe, expect, it } from "vitest";

import { MAX_GUEST_MESSAGE_LENGTH } from "@/src/domain/entities/GuestMessage";

import { guestMessageSchema } from "../guest-message-schema";

import { flattened } from "./zod-issues";

const valid = {
  phone: "0912 123 4567",
  text: "We've kept the window table.",
  about: { kind: "reservation", id: "r1" },
};

describe("guestMessageSchema", () => {
  it("trims the words and the phone", () => {
    expect(guestMessageSchema.parse({ ...valid, phone: " 09121234567 ", text: "  Hi\nSee you at 7  " })).toEqual({
      phone: "09121234567",
      text: "Hi\nSee you at 7",
      about: { kind: "reservation", id: "r1" },
    });
  });

  it("requires a message within the cap", () => {
    expect(flattened(guestMessageSchema.safeParse({ ...valid, text: "  " }).error)?.fieldErrors.text).toEqual([
      "messageRequired",
    ]);
    expect(guestMessageSchema.safeParse({ ...valid, text: "m".repeat(MAX_GUEST_MESSAGE_LENGTH) }).success).toBe(true);
    expect(
      flattened(guestMessageSchema.safeParse({ ...valid, text: "m".repeat(MAX_GUEST_MESSAGE_LENGTH + 1) }).error)
        ?.fieldErrors.text,
    ).toEqual(["textTooLong"]);
  });

  it("requires a real phone and something it's about", () => {
    expect(flattened(guestMessageSchema.safeParse({ ...valid, phone: "12" }).error)?.fieldErrors.phone).toEqual([
      "phoneInvalid",
    ]);
    expect(guestMessageSchema.safeParse({ ...valid, about: { kind: "payroll", id: "p1" } }).success).toBe(false);
    expect(guestMessageSchema.safeParse({ ...valid, about: { kind: "order", id: " " } }).success).toBe(false);
  });
});
