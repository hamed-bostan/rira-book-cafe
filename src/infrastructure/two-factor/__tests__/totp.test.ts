import { describe, expect, it } from "vitest";

import { base32Decode, base32Encode, hotp, matchTotp, timeStep } from "../totp";

/** The RFC 4226 / RFC 6238 test key for SHA-1: the ASCII bytes "12345678901234567890". */
const RFC_KEY = Buffer.from("12345678901234567890", "ascii");

describe("HOTP (RFC 4226 appendix D)", () => {
  it("matches the published 6-digit values for counters 0–9", () => {
    const expected = [
      "755224",
      "287082",
      "359152",
      "969429",
      "338314",
      "254676",
      "287922",
      "162583",
      "399871",
      "520489",
    ];
    expected.forEach((code, counter) => expect(hotp(RFC_KEY, counter, 6)).toBe(code));
  });
});

describe("TOTP (RFC 6238 appendix B, SHA-1)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("at %i seconds the 8-digit code is %s", (seconds, code) => {
    expect(hotp(RFC_KEY, timeStep(new Date(seconds * 1000), 30), 8)).toBe(code);
  });
});

describe("base32", () => {
  it("round-trips bytes and matches RFC 4648's vectors", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb oi======").toString()).toBe("foobar");
    const bytes = Buffer.from(Array.from({ length: 20 }, (_, index) => index * 13));
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
  });

  it("refuses characters outside the alphabet", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });
});

describe("matchTotp", () => {
  const options = { digits: 6, periodSeconds: 30, window: 1 };
  const now = new Date(1_700_000_000_000);
  const step = timeStep(now, 30);

  it("accepts the current code and one step either side, answering which step matched", () => {
    expect(matchTotp(RFC_KEY, hotp(RFC_KEY, step, 6), now, options)).toBe(step);
    expect(matchTotp(RFC_KEY, hotp(RFC_KEY, step - 1, 6), now, options)).toBe(step - 1);
    expect(matchTotp(RFC_KEY, hotp(RFC_KEY, step + 1, 6), now, options)).toBe(step + 1);
  });

  it("refuses codes outside the window and malformed ones", () => {
    expect(matchTotp(RFC_KEY, hotp(RFC_KEY, step - 2, 6), now, options)).toBeNull();
    expect(matchTotp(RFC_KEY, hotp(RFC_KEY, step + 2, 6), now, options)).toBeNull();
    expect(matchTotp(RFC_KEY, "12345", now, options)).toBeNull();
  });
});
