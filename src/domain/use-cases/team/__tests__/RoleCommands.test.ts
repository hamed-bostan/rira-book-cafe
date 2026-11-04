import { describe, expect, it, vi } from "vitest";

import { ROLE_PERMISSIONS } from "../../../entities/Permission";
import { RolePolicy, type RoleDefinition } from "../../../entities/Role";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { CreateRole, DeleteRole, ListRoles, UpdateRole } from "../RoleCommands";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { AuditHook } from "../../../repositories/AuditHook";
import type { IRoleRepository } from "../../../repositories/IRoleRepository";

const OWNER = { id: "owner", name: "Rira" };

/** An in-memory role table that runs each write's audit hook the way the real one does. */
function rolesWith(initial: RoleDefinition[] = []) {
  const custom = new Map(initial.map((role) => [role.key, role]));
  const entries: NewActivityEntry[] = [];
  const record = (role: RoleDefinition, audit?: AuditHook<RoleDefinition>) => {
    const entry = audit?.(role);
    if (entry) entries.push(entry);
  };
  const builtIn = (key: "support" | "staff" | "admin"): RoleDefinition =>
    custom.get(key) ?? { key, builtIn: true, name: null, permissions: [...ROLE_PERMISSIONS[key]] };

  const repo: IRoleRepository = {
    list: async () => [
      builtIn("support"),
      builtIn("staff"),
      builtIn("admin"),
      ...[...custom.values()].filter((r) => !r.builtIn),
    ],
    get: async (key) => (key.startsWith("custom:") ? (custom.get(key) ?? null) : builtIn(key as "support")),
    policy: async () => new RolePolicy(await repo.list()),
    memberCounts: async () => ({ "custom:barista01": 2 }),
    create: vi.fn(async (input, audit) => {
      const role: RoleDefinition = { key: "custom:new00001", builtIn: false, ...input };
      custom.set(role.key, role);
      record(role, audit);
      return role;
    }),
    update: vi.fn(async (key, changes, audit) => {
      const current = (await repo.get(key))!;
      const next = { ...current, ...changes };
      custom.set(key, next);
      record(next, audit);
      return next;
    }),
    delete: vi.fn(async (key, audit) => {
      const current = custom.get(key)!;
      custom.delete(key);
      record(current, audit);
    }),
  };
  return { repo, entries };
}

const BARISTA: RoleDefinition = {
  key: "custom:barista01",
  builtIn: false,
  name: { en: "Barista", fa: "باریستا" },
  permissions: ["dashboard.view", "orders.fulfill"],
};

describe("ListRoles", () => {
  it("lists the editable built-ins and custom roles with how many hold each", async () => {
    const { repo } = rolesWith([BARISTA]);
    const roles = await new ListRoles(repo).execute();
    expect(roles.map((role) => [role.key, role.memberCount])).toEqual([
      ["support", 0],
      ["staff", 0],
      ["admin", 0],
      ["custom:barista01", 2],
    ]);
  });
});

describe("CreateRole", () => {
  it("creates a named role with dashboard access always included, and records it", async () => {
    const { repo, entries } = rolesWith();
    const role = await new CreateRole(repo).execute(
      { name: { en: " Barista ", fa: " باریستا " }, permissions: ["orders.fulfill"] },
      OWNER,
    );
    expect(role.name).toEqual({ en: "Barista", fa: "باریستا" });
    expect(role.permissions).toEqual(["dashboard.view", "orders.fulfill"]);
    expect(entries).toEqual([
      expect.objectContaining({
        action: "user.roleCreated",
        entityType: "user",
        entityId: "custom:new00001",
        entityLabel: "Barista / باریستا",
        changes: [
          { field: "nameEn", before: null, after: "Barista" },
          { field: "nameFa", before: null, after: "باریستا" },
          { field: "permissions", before: null, after: "dashboard.view, orders.fulfill" },
        ],
      }),
    ]);
  });

  it("never gives team management to a role", async () => {
    const { repo } = rolesWith();
    await expect(
      new CreateRole(repo).execute({ name: { en: "Boss", fa: "رئیس" }, permissions: ["team.manage"] }, OWNER),
    ).rejects.toThrow(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses a name another role has, in either language", async () => {
    const { repo } = rolesWith([BARISTA]);
    await expect(
      new CreateRole(repo).execute({ name: { en: "barista", fa: "دیگر" }, permissions: [] }, OWNER),
    ).rejects.toMatchObject({ code: "ROLE_NAME_TAKEN" });
    await expect(
      new CreateRole(repo).execute({ name: { en: "Other", fa: "باریستا" }, permissions: [] }, OWNER),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("UpdateRole", () => {
  it("edits a built-in role's permissions and records before and after", async () => {
    const { repo, entries } = rolesWith();
    const role = await new UpdateRole(repo).execute("support", { permissions: ["orders.note"] }, OWNER);
    expect(role.permissions).toEqual(["dashboard.view", "orders.note"]);
    expect(entries[0]).toMatchObject({
      action: "user.roleUpdated",
      entityId: "support",
      entityLabel: "support",
      changes: [
        {
          field: "permissions",
          before: "dashboard.view, orders.note, activity.view",
          after: "dashboard.view, orders.note",
        },
      ],
    });
  });

  it("keeps a built-in role's name the app's", async () => {
    const { repo } = rolesWith();
    await expect(
      new UpdateRole(repo).execute("staff", { name: { en: "Floor", fa: "سالن" } }, OWNER),
    ).rejects.toMatchObject({ field: "nameEn" });
  });

  it("writes and records nothing for a save that changes nothing", async () => {
    const { repo, entries } = rolesWith([BARISTA]);
    await new UpdateRole(repo).execute("custom:barista01", { permissions: ["orders.fulfill"] }, OWNER);
    expect(repo.update).not.toHaveBeenCalled();
    expect(entries).toEqual([]);
  });
});

describe("DeleteRole", () => {
  it("deletes a custom role and records what it was", async () => {
    const { repo, entries } = rolesWith([BARISTA]);
    await new DeleteRole(repo).execute("custom:barista01", OWNER);
    expect(entries[0]).toMatchObject({
      action: "user.roleDeleted",
      changes: expect.arrayContaining([{ field: "nameEn", before: "Barista", after: null }]),
    });
  });

  it("refuses a built-in role", async () => {
    const { repo } = rolesWith();
    await expect(new DeleteRole(repo).execute("admin", OWNER)).rejects.toMatchObject({ code: "ROLE_BUILT_IN" });
  });
});
