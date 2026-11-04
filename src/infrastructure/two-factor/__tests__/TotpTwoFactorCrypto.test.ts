import { describe, expect, it } from "vitest";

import { normalizeRecoveryCode, RECOVERY_CODE_COUNT } from "@/src/domain/entities/TwoFactor";

import { base32Decode, hotp, timeStep } from "../totp";
import { parseTwoFactorKey, TotpTwoFactorCrypto } from "../TotpTwoFactorCrypto";

const KEY = Buffer.alloc(32, 7);

describe("parseTwoFactorKey", () => {
  it("takes 32 bytes as hex or base64, and nothing else", () => {
    expect(parseTwoFactorKey("07".repeat(32))?.equals(KEY)).toBe(true);
    expect(parseTwoFactorKey(KEY.toString("base64"))?.equals(KEY)).toBe(true);
    expect(parseTwoFactorKey(undefined)).toBeNull();
    expect(parseTwoFactorKey("too-short")).toBeNull();
  });
});

describe("TotpTwoFactorCrypto", () => {
  const crypto = new TotpTwoFactorCrypto(KEY);

  it("seals a secret so only the same key opens it, and a tampered one doesn't open at all", () => {
    const secret = crypto.newSecret();
    const sealed = crypto.seal(secret);
    expect(sealed).not.toContain(secret);
    expect(crypto.open(sealed)).toBe(secret);
    // A fresh IV each time: the same secret never seals to the same text.
    expect(crypto.seal(secret)).not.toBe(sealed);

    const [version, iv, tag, body] = sealed.split(":");
    const flipped = body.startsWith("A") ? `B${body.slice(1)}` : `A${body.slice(1)}`;
    expect(() => crypto.open([version, iv, tag, flipped].join(":"))).toThrow();
    expect(() => new TotpTwoFactorCrypto(Buffer.alloc(32, 9)).open(sealed)).toThrow();
  });

  it("is unavailable without a key, and refuses to seal or open", () => {
    const off = new TotpTwoFactorCrypto(null);
    expect(off.available).toBe(false);
    expect(() => off.seal("X")).toThrow();
    expect(() => off.open("v1:a:b:c")).toThrow();
    // Recovery codes still hash: an enrolled user can still get in with one.
    expect(off.hashRecoveryCode("ABCDEFGHIJKLMNOP")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("makes 160-bit base32 secrets and matches their codes", () => {
    const secret = crypto.newSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    const now = new Date();
    const code = hotp(base32Decode(secret), timeStep(now, 30), 6);
    expect(crypto.matchCode(secret, code, now)).toBe(timeStep(now, 30));
  });

  it("issues distinct recovery codes that normalize and hash the same however they're typed", () => {
    const codes = crypto.newRecoveryCodes(RECOVERY_CODE_COUNT);
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/);

    const typed = normalizeRecoveryCode(codes[0].toLowerCase().replaceAll("-", " "));
    expect(typed).not.toBeNull();
    expect(crypto.hashRecoveryCode(typed!)).toBe(crypto.hashRecoveryCode(normalizeRecoveryCode(codes[0])!));
  });

  it("builds an otpauth URI an authenticator app reads", () => {
    const uri = new URL(crypto.otpauthUri("JBSWY3DPEHPK3PXP", "09120000001"));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(uri.searchParams.get("issuer")).toBe("Rira Book Cafe");
    expect(uri.searchParams.get("digits")).toBe("6");
    expect(decodeURIComponent(uri.pathname)).toContain("Rira Book Cafe:09120000001");
  });

  it("draws the URI as a PNG QR code", async () => {
    expect(await crypto.qrCode("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP")).toMatch(/^data:image\/png;base64,/);
  });
});
