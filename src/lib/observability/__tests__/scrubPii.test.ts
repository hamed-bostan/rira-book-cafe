import { describe, expect, it } from "vitest";

import { PHONE_MASK, REDACTED, scrubEvent, scrubPhoneNumbers, scrubValue } from "../scrubPii";

import type { ErrorEvent } from "@sentry/nextjs";

describe("scrubPhoneNumbers", () => {
  it.each([
    "09121234567",
    "0912 123 4567",
    "0912-123-4567",
    "+989121234567",
    "00989121234567",
    "989121234567",
    "۰۹۱۲۱۲۳۴۵۶۷",
    "+4915112345678",
  ])("masks %s", (phone) => {
    expect(scrubPhoneNumbers(`notify ${phone}: failed`)).toBe(`notify ${PHONE_MASK}: failed`);
  });

  it("masks phones inside URLs", () => {
    expect(scrubPhoneNumbers("/api/admin/users/09121234567?x=1")).toBe(`/api/admin/users/${PHONE_MASK}?x=1`);
  });

  it("leaves longer digit runs and non-phone numbers alone", () => {
    expect(scrubPhoneNumbers("ts=1760000000000 order 4821 price 120000")).toBe(
      "ts=1760000000000 order 4821 price 120000",
    );
    expect(scrubPhoneNumbers("091212345678")).toBe("091212345678");
  });
});

describe("scrubValue", () => {
  it("drops values under sensitive keys and masks nested strings", () => {
    expect(
      scrubValue({
        phone: "09121234567",
        nested: { password: "x", note: "call 09121234567", list: ["09121234567"] },
        otpCode: "1234",
        count: 3,
      }),
    ).toEqual({
      phone: REDACTED,
      nested: { password: REDACTED, note: `call ${PHONE_MASK}`, list: [PHONE_MASK] },
      otpCode: REDACTED,
      count: 3,
    });
  });
});

describe("scrubEvent", () => {
  it("strips credentials and the user, and tags the request id", () => {
    const event = scrubEvent<ErrorEvent>({
      type: undefined,
      message: "failed for 09121234567",
      user: { id: "09121234567", ip_address: "1.2.3.4" },
      request: {
        url: "https://rira.example/api/x",
        cookies: { "authjs.session-token": "abc" },
        headers: {
          Cookie: "authjs.session-token=abc",
          authorization: "Bearer abc",
          "x-forwarded-for": "1.2.3.4",
          "x-request-id": "req-42",
          "user-agent": "test",
        },
      },
    });

    expect(event.user).toBeUndefined();
    expect(event.message).toBe(`failed for ${PHONE_MASK}`);
    expect(event.request).toEqual({
      url: "https://rira.example/api/x",
      headers: { "x-request-id": "req-42", "user-agent": "test" },
    });
    expect(event.tags).toEqual({ request_id: "req-42" });
  });
});
