import { describe, expect, it } from "vitest";

import { clientIp } from "../client-ip";

describe("clientIp", () => {
  it("takes the address the trusted proxy appended, not what the client claimed", () => {
    // nginx's $proxy_add_x_forwarded_for appends the real peer to a spoofed header.
    const headers = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("reads further left when more proxies are trusted", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.2, 203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers, 2)).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("ignores empty entries", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " , 203.0.113.7 ," }))).toBe("203.0.113.7");
  });
});
