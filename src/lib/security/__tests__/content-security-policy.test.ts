import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, generateNonce, originOf } from "../content-security-policy";

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")];
    }),
  );
}

describe("buildContentSecurityPolicy", () => {
  const base = { nonce: "abc123", isDev: false, upgradeInsecureRequests: false };

  it("allows scripts only by nonce, never inline or eval in production", () => {
    const script = directives(buildContentSecurityPolicy(base)).get("script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("adds 'unsafe-eval' in development only", () => {
    const script = directives(buildContentSecurityPolicy({ ...base, isDev: true })).get("script-src");
    expect(script).toContain("'unsafe-eval'");
  });

  it("forbids framing, plugins and foreign base URLs", () => {
    const policy = directives(buildContentSecurityPolicy(base));
    expect(policy.get("frame-ancestors")).toBe("'none'");
    expect(policy.get("object-src")).toBe("'none'");
    expect(policy.get("base-uri")).toBe("'self'");
    expect(policy.get("img-src")).toBe("'self' data: blob:");
  });

  it("upgrades insecure requests only when asked", () => {
    expect(buildContentSecurityPolicy(base)).not.toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ ...base, upgradeInsecureRequests: true })).toContain(
      "upgrade-insecure-requests",
    );
  });

  it("appends extra connect sources", () => {
    const policy = directives(buildContentSecurityPolicy({ ...base, connectSources: ["https://api.example.com"] }));
    expect(policy.get("connect-src")).toBe("'self' https://api.example.com");
  });
});

describe("generateNonce", () => {
  it("is unique per call and base64", () => {
    const a = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(generateNonce()).not.toBe(a);
  });
});

describe("originOf", () => {
  it("returns the origin of an absolute URL and null otherwise", () => {
    expect(originOf("https://api.example.com/api")).toBe("https://api.example.com");
    expect(originOf("/api")).toBeNull();
    expect(originOf(undefined)).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});
