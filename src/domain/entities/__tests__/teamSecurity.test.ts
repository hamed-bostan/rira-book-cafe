import { describe, expect, it } from "vitest";

import { activityRetentionCutoff, validRetentionMonths } from "../TeamSettings";
import { normalizeRecoveryCode, normalizeTotpCode, secondFactorGate, twoFactorStatus } from "../TwoFactor";
import { describeUserAgent, isSessionActive, SESSION_MAX_AGE_MS } from "../UserSession";

describe("normalizeTotpCode", () => {
  it("takes six digits however they're typed — spaced, dashed, in Persian digits", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
    expect(normalizeTotpCode(" 123 456 ")).toBe("123456");
    expect(normalizeTotpCode("123-456")).toBe("123456");
    expect(normalizeTotpCode("۱۲۳۴۵۶")).toBe("123456");
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("12345a")).toBeNull();
  });
});

describe("normalizeRecoveryCode", () => {
  it("ignores case and separators, and refuses anything not 16 base32 characters", () => {
    expect(normalizeRecoveryCode("abcd-efgh-ijkl-mnop")).toBe("ABCDEFGHIJKLMNOP");
    expect(normalizeRecoveryCode("ABCD EFGH IJKL MNOP")).toBe("ABCDEFGHIJKLMNOP");
    expect(normalizeRecoveryCode("ABCD-EFGH")).toBeNull();
    expect(normalizeRecoveryCode("ABCD-EFGH-IJKL-MNO1")).toBeNull();
  });
});

describe("twoFactorStatus", () => {
  const record = { userId: "u", sealedSecret: "s", lastUsedStep: null, recoveryCodeHashes: ["a", "b"] };

  it("reads off, pending and on", () => {
    expect(twoFactorStatus(null).state).toBe("off");
    expect(twoFactorStatus({ ...record, enabledAt: null })).toMatchObject({ state: "pending", recoveryCodesLeft: 0 });
    expect(twoFactorStatus({ ...record, enabledAt: new Date() })).toMatchObject({ state: "on", recoveryCodesLeft: 2 });
  });
});

describe("secondFactorGate", () => {
  const gate = (input: Partial<Parameters<typeof secondFactorGate>[0]>) =>
    secondFactorGate({ state: "off", requiredByOwner: false, available: true, verifiedInThisSession: false, ...input });

  it("lets through a browser that already passed, whatever else is true", () => {
    expect(gate({ state: "on", verifiedInThisSession: true })).toBe("ok");
    expect(gate({ requiredByOwner: true, verifiedInThisSession: true })).toBe("ok");
  });

  it("asks someone enrolled for a code — even when the key is missing (recovery codes still work)", () => {
    expect(gate({ state: "on" })).toBe("verify");
    expect(gate({ state: "on", available: false })).toBe("verify");
  });

  it("sends someone without an app to set one up only when required and possible", () => {
    expect(gate({ requiredByOwner: true })).toBe("enroll");
    expect(gate({ state: "pending", requiredByOwner: true })).toBe("enroll");
    expect(gate({ requiredByOwner: true, available: false })).toBe("ok");
    expect(gate({})).toBe("ok");
    expect(gate({ state: "pending" })).toBe("ok");
  });
});

describe("describeUserAgent", () => {
  it("names the browser and system, and the kind of device", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Windows", kind: "desktop" });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ browser: "Safari", os: "iOS", kind: "mobile" });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      ).browser,
    ).toBe("Edge");
    expect(describeUserAgent("Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0")).toEqual({
      browser: "Firefox",
      os: "Android",
      kind: "mobile",
    });
  });

  it("admits not knowing", () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null, kind: "unknown" });
    expect(describeUserAgent("curl/8.0")).toEqual({ browser: null, os: null, kind: "unknown" });
  });
});

describe("isSessionActive", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("is active until revoked or idle for longer than a session lives", () => {
    expect(isSessionActive({ revokedAt: null, lastSeenAt: now }, now)).toBe(true);
    expect(isSessionActive({ revokedAt: now, lastSeenAt: now }, now)).toBe(false);
    expect(
      isSessionActive({ revokedAt: null, lastSeenAt: new Date(now.getTime() - SESSION_MAX_AGE_MS - 1) }, now),
    ).toBe(false);
  });
});

describe("activity retention", () => {
  it("cuts off whole calendar months back, clamping to the shorter month", () => {
    expect(activityRetentionCutoff(new Date("2026-11-04T10:00:00Z"), 12).toISOString()).toBe(
      "2025-11-04T10:00:00.000Z",
    );
    expect(activityRetentionCutoff(new Date("2026-03-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(activityRetentionCutoff(new Date("2026-01-15T00:00:00Z"), 6).toISOString()).toBe("2025-07-15T00:00:00.000Z");
  });

  it("takes forever or one of the offered periods", () => {
    expect(validRetentionMonths(null)).toBeNull();
    expect(validRetentionMonths(12)).toBe(12);
    expect(() => validRetentionMonths(1)).toThrow();
    expect(() => validRetentionMonths(7)).toThrow();
  });
});
