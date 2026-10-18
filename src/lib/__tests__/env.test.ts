import { describe, expect, it } from "vitest";

import { envWarnings, parseEnv } from "../env";

const DEV = { NODE_ENV: "development", DATABASE_URL: "postgresql://rira:pw@localhost:5545/rira" };
const PROD = {
  ...DEV,
  NODE_ENV: "production",
  AUTH_SECRET: "x".repeat(44),
  SMS_IR_API_KEY: "key",
  SMS_IR_TEMPLATE_ID: "123456",
  APP_URL: "https://cafe.example",
  ZARINPAL_MERCHANT_ID: "merchant",
};

describe("parseEnv", () => {
  it("accepts a minimal development environment and fills defaults", () => {
    const env = parseEnv(DEV);
    expect(env.SMTP_PORT).toBe(587);
    expect(env.TRUSTED_PROXY_HOPS).toBe(1);
    expect(env.OTP_MOCK).toBe(false);
    expect(env.ADMIN_USER_IDS).toEqual([]);
  });

  it("treats empty `KEY=` lines as unset", () => {
    const env = parseEnv({ ...DEV, SMTP_PORT: "", APP_URL: "", OTP_MOCK: "", SMS_IR_TEMPLATE_ID: "" });
    expect(env.SMTP_PORT).toBe(587);
    expect(env.APP_URL).toBeUndefined();
    expect(env.OTP_MOCK).toBe(false);
    expect(env.SMS_IR_TEMPLATE_ID).toBeUndefined();
  });

  it("parses typed values", () => {
    const env = parseEnv({
      ...DEV,
      ADMIN_USER_IDS: " 09121234567, ,09350000000 ",
      SMTP_PORT: "465",
      OTP_MOCK: "true",
      SMS_IR_TEMPLATE_ID: "42",
    });
    expect(env.ADMIN_USER_IDS).toEqual(["09121234567", "09350000000"]);
    expect(env.SMTP_PORT).toBe(465);
    expect(env.OTP_MOCK).toBe(true);
    expect(env.SMS_IR_TEMPLATE_ID).toBe(42);
  });

  it.each([
    ["DATABASE_URL", { DATABASE_URL: undefined }],
    ["DATABASE_URL", { DATABASE_URL: "mysql://nope" }],
    ["APP_URL", { APP_URL: "not a url" }],
    ["SMTP_PORT", { SMTP_PORT: "abc" }],
    ["OTP_MOCK", { OTP_MOCK: "yes" }],
    ["NODE_ENV", { NODE_ENV: "staging" }],
    ["SMS_IR_TEMPLATE_ID", { SMS_IR_API_KEY: "key" }],
  ])("rejects a bad %s, naming it", (name, overrides) => {
    expect(() => parseEnv({ ...DEV, ...overrides })).toThrow(new RegExp(`${name}:`));
  });

  it("lists every problem at once", () => {
    expect(() => parseEnv({ ...DEV, APP_URL: "nope", SMTP_PORT: "abc" })).toThrow(/APP_URL:[\s\S]*SMTP_PORT:/);
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL:[\s\S]*AUTH_SECRET:/);
  });

  describe("in production", () => {
    it("accepts a complete configuration", () => {
      expect(() => parseEnv(PROD)).not.toThrow();
    });

    it("requires a strong AUTH_SECRET", () => {
      expect(() => parseEnv({ ...PROD, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET:/);
      expect(() => parseEnv({ ...PROD, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET:/);
    });

    it("skips the required/production rules when not strict (next build)", () => {
      expect(() => parseEnv({ NODE_ENV: "production" }, { strict: false })).not.toThrow();
    });
  });
});

describe("envWarnings", () => {
  it("is quiet for a complete production configuration and in development", () => {
    expect(envWarnings(parseEnv(PROD))).toEqual([]);
    expect(envWarnings(parseEnv(DEV))).toEqual([]);
  });

  it("flags the mock OTP provider, a missing APP_URL and sandbox payments in production", () => {
    const warnings = envWarnings(parseEnv({ ...PROD, OTP_MOCK: "true", APP_URL: undefined, ZARINPAL_SANDBOX: "true" }));
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatch(/MOCK OTP/);
  });
});
