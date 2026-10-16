import { describe, expect, it } from "vitest";

import { isPublicNavActive } from "../publicNavigation";

describe("isPublicNavActive", () => {
  it("matches home only on itself", () => {
    expect(isPublicNavActive("/", "/")).toBe(true);
    expect(isPublicNavActive("/", "/menu")).toBe(false);
  });

  it("owns subtrees without matching siblings", () => {
    expect(isPublicNavActive("/menu", "/menu/abc")).toBe(true);
    expect(isPublicNavActive("/events", "/events-archive")).toBe(false);
  });

  it("treats orders and reservations as part of the account", () => {
    expect(isPublicNavActive("/account", "/orders/123")).toBe(true);
    expect(isPublicNavActive("/account", "/reservations")).toBe(true);
    expect(isPublicNavActive("/book", "/reservations")).toBe(false);
  });
});
