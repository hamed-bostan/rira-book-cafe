import { describe, expect, it } from "vitest";

import { profileResponseSchema } from "../profile-response-schema";
import { profileUpdateSchema } from "../profile-schema";

import { flattened } from "./zod-issues";

describe("profileUpdateSchema", () => {
  it("trims the name and email", () => {
    expect(profileUpdateSchema.parse({ name: " Hamed ", email: " guest@example.com " })).toEqual({
      name: "Hamed",
      email: "guest@example.com",
    });
  });

  it("accepts an empty email, which clears it", () => {
    expect(profileUpdateSchema.parse({ name: "Hamed", email: "" })).toEqual({ name: "Hamed", email: "" });
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = flattened(
      profileUpdateSchema.safeParse({ name: " ", email: "not-an-email" }).error,
    )?.fieldErrors;
    expect(fieldErrors).toEqual({ name: ["nameRequired"], email: ["emailInvalid"] });
  });

  it("caps the name and the email", () => {
    const fieldErrors = flattened(
      profileUpdateSchema.safeParse({ name: "n".repeat(81), email: `${"a".repeat(115)}@example.com` }).error,
    )?.fieldErrors;
    expect(fieldErrors).toEqual({ name: ["nameTooLong"], email: ["emailTooLong"] });
  });
});

describe("profileResponseSchema", () => {
  it("reads a profile with or without an email", () => {
    const profile = { id: "u1", name: "Hamed", phone: "09123456789", email: null };
    expect(profileResponseSchema.parse(profile)).toEqual(profile);
    expect(profileResponseSchema.safeParse({ ...profile, email: undefined }).success).toBe(false);
  });
});
