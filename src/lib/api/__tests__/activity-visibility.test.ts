import { describe, expect, it } from "vitest";

import { ACTIVITY_ENTITY_TYPES } from "@/src/domain/entities/ActivityEntry";
import { ROLE_PERMISSIONS } from "@/src/domain/entities/Permission";

import { canReadActivityEntityType, redactActivityEntry, visibleActivityEntityTypes } from "../activity-visibility";

const { staff, support, admin, owner } = ROLE_PERMISSIONS;
const MONEY = ["ledger", "expense", "income", "payroll"] as const;

describe("visibleActivityEntityTypes", () => {
  it.each([
    ["staff", staff],
    ["support", support],
  ])("keeps the books, payroll and team access from %s, and leaves them the floor", (_role, permissions) => {
    const visible = visibleActivityEntityTypes(permissions);

    for (const type of [...MONEY, "user"] as const) expect(visible).not.toContain(type);
    for (const type of ["order", "product", "reservation", "bookLoan", "event"] as const) {
      expect(visible).toContain(type);
    }
  });

  it("gives an admin everything but team access", () => {
    expect(visibleActivityEntityTypes(admin)).toEqual(ACTIVITY_ENTITY_TYPES.filter((type) => type !== "user"));
  });

  it("leaves the owner unrestricted", () => {
    expect(visibleActivityEntityTypes(owner)).toBeUndefined();
  });

  it("follows the permission, so taking payroll from admins would take its entries too", () => {
    const withoutPayroll = admin.filter((permission) => permission !== "payroll.manage");

    expect(visibleActivityEntityTypes(withoutPayroll)).not.toContain("payroll");
    expect(visibleActivityEntityTypes(withoutPayroll)).toContain("expense");
  });

  it("shows nothing to someone with no permissions", () => {
    expect(visibleActivityEntityTypes([])).toEqual([]);
  });
});

describe("canReadActivityEntityType", () => {
  it("agrees with the list, for every role and every type", () => {
    for (const permissions of [staff, support, admin]) {
      const visible = visibleActivityEntityTypes(permissions);
      for (const type of ACTIVITY_ENTITY_TYPES) {
        expect(canReadActivityEntityType(type, permissions)).toBe(visible?.includes(type));
      }
    }
  });

  it("answers a type this build doesn't know with an empty panel, not a refusal", () => {
    expect(canReadActivityEntityType("unknown", staff)).toBe(true);
  });
});

describe("redactActivityEntry", () => {
  const ENTRY = {
    id: "a1",
    changes: [
      { field: "price", before: "90000", after: "95000" },
      { field: "costPrice", before: "40000", after: "45000" },
    ],
  };

  it("takes a cost price's figures from someone who can't see costs, and keeps that it moved", () => {
    expect(redactActivityEntry(ENTRY, staff).changes).toEqual([
      { field: "price", before: "90000", after: "95000" },
      { field: "costPrice", before: null, after: null },
    ]);
  });

  it("leaves it for someone who can", () => {
    expect(redactActivityEntry(ENTRY, admin)).toBe(ENTRY);
  });

  it("leaves an entry with nothing to hide as it was", () => {
    const plain = { changes: [{ field: "status", before: "new", after: "done" }] };

    expect(redactActivityEntry(plain, staff)).toBe(plain);
  });

  it("doesn't touch the entry it's given", () => {
    redactActivityEntry(ENTRY, staff);

    expect(ENTRY.changes[1].before).toBe("40000");
  });
});
