import { describe, expect, it } from "vitest";

import { PERMISSIONS, roleHasPermission } from "../Permission";
import { DASHBOARD_ROLES, USER_ROLES } from "../User";

describe("ROLE_PERMISSIONS", () => {
  it("gives customers nothing", () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission("customer", permission)).toBe(false);
    }
  });

  it("reserves team management to the owner", () => {
    for (const role of USER_ROLES) {
      expect(roleHasPermission(role, "team.manage")).toBe(role === "owner");
    }
  });

  it("keeps the catalog out of staff and support hands", () => {
    expect(roleHasPermission("staff", "catalog.write")).toBe(false);
    expect(roleHasPermission("support", "catalog.write")).toBe(false);
    expect(roleHasPermission("admin", "catalog.write")).toBe(true);
  });

  it("lets the floor manage reservations but only admins run events", () => {
    expect(roleHasPermission("staff", "reservations.manage")).toBe(true);
    expect(roleHasPermission("support", "reservations.manage")).toBe(false);
    expect(roleHasPermission("staff", "events.manage")).toBe(false);
    expect(roleHasPermission("admin", "events.manage")).toBe(true);
  });

  it("derives dashboard roles from dashboard.view", () => {
    expect(DASHBOARD_ROLES).toEqual(["support", "staff", "admin", "owner"]);
  });
});
