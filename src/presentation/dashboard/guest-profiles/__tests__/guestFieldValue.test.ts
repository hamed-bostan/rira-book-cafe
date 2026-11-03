import { describe, expect, it } from "vitest";

import { guestLookupResponseSchema } from "../guest-lookup-response-schema";
import { guestFieldValue } from "../guestFieldValue";

describe("guestFieldValue", () => {
  it("holds the form back while the number can't be anyone's yet, or is being looked up", () => {
    expect(guestFieldValue("0912", "", null)).toBeNull();
    expect(guestFieldValue("0912 345 6789", "Sara", { state: "checking" })).toBeNull();
  });

  it("sends just the phone for a guest with a named profile, whatever name was typed before", () => {
    const found = { state: "found", match: { name: "Sara Ahmadi", signedIn: false } } as const;
    expect(guestFieldValue(" 0912 345 6789 ", "Someone", found)).toEqual({ phone: "0912 345 6789" });
  });

  it("needs a name for a new guest, or a profile with none on it", () => {
    const unnamed = { state: "found", match: { name: null, signedIn: true } } as const;
    for (const lookup of [{ state: "new" } as const, unnamed]) {
      expect(guestFieldValue("0912 345 6789", "  ", lookup)).toBeNull();
      expect(guestFieldValue("0912 345 6789", " Sara ", lookup)).toEqual({ phone: "0912 345 6789", name: "Sara" });
    }
  });

  it("lets the server decide when the lookup failed, with the name if one was typed", () => {
    expect(guestFieldValue("0912 345 6789", "", { state: "failed" })).toEqual({
      phone: "0912 345 6789",
      name: undefined,
    });
  });
});

describe("guestLookupResponseSchema", () => {
  it("reads both answers the lookup gives, and nothing else", () => {
    expect(guestLookupResponseSchema.parse({ found: false })).toEqual({ found: false });
    expect(guestLookupResponseSchema.parse({ found: true, name: null, signedIn: false })).toEqual({
      found: true,
      name: null,
      signedIn: false,
    });
    expect(guestLookupResponseSchema.safeParse({ found: true, name: "Sara" }).success).toBe(false);
  });
});
