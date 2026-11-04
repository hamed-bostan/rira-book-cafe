import { describe, expect, it } from "vitest";

import { ValidationError } from "../../errors/ValidationError";
import { PERMISSION_GROUPS, PERMISSIONS, ROLE_PERMISSIONS } from "../Permission";
import { normalizeRolePermissions, RolePolicy, type RoleDefinition } from "../Role";
import { USER_ROLES } from "../User";

/** The policy with nothing stored — exactly today's `ROLE_PERMISSIONS`. */
const defaults = RolePolicy.defaults();

describe("ROLE_PERMISSIONS (the default policy)", () => {
  it("gives customers nothing", () => {
    for (const permission of PERMISSIONS) {
      expect(defaults.has("customer", permission)).toBe(false);
    }
  });

  it("reserves team management to the owner", () => {
    for (const role of USER_ROLES) {
      expect(defaults.has(role, "team.manage")).toBe(role === "owner");
    }
  });

  it("keeps the catalog out of staff and support hands", () => {
    expect(defaults.has("staff", "catalog.write")).toBe(false);
    expect(defaults.has("support", "catalog.write")).toBe(false);
    expect(defaults.has("admin", "catalog.write")).toBe(true);
  });

  it("lets the floor manage reservations but only admins run events", () => {
    expect(defaults.has("staff", "reservations.manage")).toBe(true);
    expect(defaults.has("support", "reservations.manage")).toBe(false);
    expect(defaults.has("staff", "events.manage")).toBe(false);
    expect(defaults.has("admin", "events.manage")).toBe(true);
  });

  it("keeps revenue to admins and the owner", () => {
    expect(defaults.has("staff", "reports.view")).toBe(false);
    expect(defaults.has("support", "reports.view")).toBe(false);
    expect(defaults.has("admin", "reports.view")).toBe(true);
    expect(defaults.has("owner", "reports.view")).toBe(true);
  });

  it("keeps pay per person to admins and the owner, away from everyone with the activity log", () => {
    expect(defaults.has("staff", "payroll.manage")).toBe(false);
    expect(defaults.has("support", "payroll.manage")).toBe(false);
    expect(defaults.has("admin", "payroll.manage")).toBe(true);
    expect(defaults.has("owner", "payroll.manage")).toBe(true);
  });

  it("gives every built-in team role dashboard access", () => {
    for (const role of ["support", "staff", "admin", "owner"] as const) {
      expect(defaults.has(role, "dashboard.view")).toBe(true);
    }
  });
});

describe("PERMISSION_GROUPS", () => {
  it("lists every permission exactly once", () => {
    const listed = PERMISSION_GROUPS.flatMap((group) => [...group.permissions]);
    expect([...listed].sort()).toEqual([...PERMISSIONS].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("RolePolicy", () => {
  const stored = (
    definition: Partial<RoleDefinition> & Pick<RoleDefinition, "key" | "permissions">,
  ): RoleDefinition => ({
    builtIn: !definition.key.startsWith("custom:"),
    name: null,
    ...definition,
  });

  it("uses a built-in role's stored set over its default", () => {
    const policy = new RolePolicy([stored({ key: "staff", permissions: ["dashboard.view", "catalog.write"] })]);
    expect(policy.has("staff", "catalog.write")).toBe(true);
    expect(policy.has("staff", "orders.fulfill")).toBe(false);
    // Untouched roles keep their defaults.
    expect(policy.permissionsOf("support")).toEqual(ROLE_PERMISSIONS.support);
  });

  it("always gives the owner everything, whatever is stored", () => {
    const policy = new RolePolicy([stored({ key: "admin", permissions: [] })]);
    expect(policy.permissionsOf("owner")).toEqual(PERMISSIONS);
  });

  it("answers a custom role from its row, and a missing one with nothing", () => {
    const policy = new RolePolicy([
      stored({ key: "custom:barista01", permissions: ["dashboard.view", "orders.fulfill"] }),
    ]);
    expect(policy.has("custom:barista01", "orders.fulfill")).toBe(true);
    expect(policy.permissionsOf("custom:deleted01")).toEqual([]);
  });

  it("never lets a stored row carry team management", () => {
    const policy = new RolePolicy([stored({ key: "admin", permissions: ["dashboard.view", "team.manage"] })]);
    expect(policy.has("admin", "team.manage")).toBe(false);
  });
});

describe("normalizeRolePermissions", () => {
  it("dedupes, orders by the catalog and always adds dashboard access", () => {
    expect(normalizeRolePermissions(["orders.note", "activity.view", "orders.note"])).toEqual([
      "dashboard.view",
      "orders.note",
      "activity.view",
    ]);
  });

  it("refuses team management and unknown permissions", () => {
    expect(() => normalizeRolePermissions(["team.manage"])).toThrow(ValidationError);
    expect(() => normalizeRolePermissions(["root.everything"])).toThrow(ValidationError);
  });
});
