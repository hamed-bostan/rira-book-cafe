import { describe, expect, it } from "vitest";

import { isCrossSiteMutation, type CsrfCheckInput } from "../csrf";

const HOST = "cafe.example:8080";

function check(overrides: Partial<CsrfCheckInput>): boolean {
  return isCrossSiteMutation({ method: "POST", secFetchSite: null, origin: null, host: HOST, ...overrides });
}

describe("isCrossSiteMutation", () => {
  it("never blocks safe methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(check({ method, secFetchSite: "cross-site", origin: "https://evil.example" })).toBe(false);
    }
  });

  it("checks every state-changing method, case-insensitively", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "delete"]) {
      expect(check({ method, secFetchSite: "cross-site" })).toBe(true);
    }
  });

  describe("with Sec-Fetch-Site", () => {
    it("accepts same-origin and user-initiated requests", () => {
      expect(check({ secFetchSite: "same-origin" })).toBe(false);
      expect(check({ secFetchSite: "none" })).toBe(false);
    });

    it("rejects cross-site and same-site requests (a sibling app on the same host is same-site)", () => {
      expect(check({ secFetchSite: "cross-site", origin: "https://evil.example" })).toBe(true);
      expect(check({ secFetchSite: "same-site", origin: "http://cafe.example:80" })).toBe(true);
    });

    it("trusts the header over a matching Origin", () => {
      expect(check({ secFetchSite: "cross-site", origin: `http://${HOST}` })).toBe(true);
    });
  });

  describe("without Sec-Fetch-Site (older browsers)", () => {
    it("accepts an Origin whose host matches the request's, whatever the scheme", () => {
      expect(check({ origin: `http://${HOST}` })).toBe(false);
      expect(check({ origin: `https://${HOST.toUpperCase()}` })).toBe(false);
    });

    it("rejects a foreign Origin, a different port, and the opaque `null` origin", () => {
      expect(check({ origin: "https://evil.example" })).toBe(true);
      expect(check({ origin: "http://cafe.example:3000" })).toBe(true);
      expect(check({ origin: "null" })).toBe(true);
      expect(check({ origin: "not a url" })).toBe(true);
    });

    it("rejects when the request has no host to compare against", () => {
      expect(check({ origin: `http://${HOST}`, host: null })).toBe(true);
    });

    it("lets non-browser clients (no Origin, no Sec-Fetch-Site) through", () => {
      expect(check({})).toBe(false);
    });
  });

  it("accepts an explicitly trusted origin even when the browser calls it cross-site", () => {
    expect(
      check({ secFetchSite: "cross-site", origin: "https://cafe.example", trustedOrigins: ["https://cafe.example"] }),
    ).toBe(false);
  });
});
