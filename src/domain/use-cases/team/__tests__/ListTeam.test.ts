import { describe, expect, it, vi } from "vitest";

import { ROLE_CHANGE_FIELD, roleChangeKind, roleMove } from "../../../entities/RoleChange";
import { DASHBOARD_ROLES, isDashboardRole, toUserRole, type User, type UserRole } from "../../../entities/User";
import { ListTeam } from "../ListTeam";
import { roleChangeEntry } from "../roleChangeEntry";

import type { IUserRepository } from "../../../repositories/IUserRepository";

function user(id: string, role: UserRole): User {
  return { id, phone: id, name: id, email: null, avatarUrl: null, role };
}

function repoWith(users: User[]): {
  repo: IUserRepository;
  listByRoles: ReturnType<typeof vi.fn<IUserRepository["listByRoles"]>>;
} {
  const listByRoles = vi.fn<IUserRepository["listByRoles"]>(async (roles) =>
    users.filter((u) => roles.includes(u.role)),
  );
  const repo = {
    listByRoles,
    getById: vi.fn(async (id: string) => users.find((u) => u.id === id) ?? null),
  } as unknown as IUserRepository;
  return { repo, listByRoles };
}

describe("ListTeam", () => {
  it("lists everyone with a dashboard role", async () => {
    const { repo, listByRoles } = repoWith([user("owner", "owner"), user("s", "support"), user("c", "customer")]);
    const team = await new ListTeam(repo).execute();
    expect(listByRoles).toHaveBeenCalledWith(DASHBOARD_ROLES);
    expect(team.map((u) => u.id)).toEqual(["owner", "s"]);
  });

  it("adds break-glass accounts once, skipping ids with no user row", async () => {
    const { repo } = repoWith([user("owner", "owner"), user("bg", "customer")]);
    const team = await new ListTeam(repo).execute(["owner", "bg", "ghost"]);
    expect(team.map((u) => u.id)).toEqual(["owner", "bg"]);
  });
});

describe("roleChangeEntry", () => {
  it("builds the same user.roleChanged entry for every team change", () => {
    expect(
      roleChangeEntry({
        user: { id: "u1", name: "Sara" },
        actor: { id: "owner", name: "Rira" },
        fromRole: "customer",
        toRole: "staff",
      }),
    ).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "user.roleChanged",
      entityType: "user",
      entityId: "u1",
      entityLabel: "Sara",
      changes: [{ field: ROLE_CHANGE_FIELD, before: "customer", after: "staff" }],
    });
  });
});

describe("reading role changes back", () => {
  const change = (
    before: string | null,
    after: string | null,
  ): { field: string; before: string | null; after: string | null }[] => [{ field: "role", before, after }];

  it("pulls the move out of a diff, defaulting unreadable roles to customer", () => {
    expect(roleMove([{ field: "name", before: "a", after: "b" }])).toBeNull();
    expect(roleMove(change(null, "admin"))).toEqual({ fromRole: "customer", toRole: "admin" });
    expect(roleMove(change("wizard", "staff"))).toEqual({ fromRole: "customer", toRole: "staff" });
  });

  it.each<[string | null, string | null, string, string]>([
    ["customer", "staff", "u", "granted"],
    ["admin", "customer", "u", "revoked"],
    ["admin", "owner", "u", "ownershipClaimed"],
    ["admin", "owner", "someone-else", "ownershipTransferred"],
    ["owner", "admin", "u", "steppedDown"],
  ])("reads %s → %s by %s as %s", (before, after, actorId, kind) => {
    expect(roleChangeKind({ userId: "u", actorId, changes: change(before, after) })).toBe(kind);
  });

  it("reads an entry with no role move as unknown", () => {
    expect(roleChangeKind({ userId: "u", actorId: "u", changes: [] })).toBe("unknown");
  });

  it("narrows stored roles and knows who reaches the dashboard", () => {
    expect(toUserRole("admin")).toBe("admin");
    expect(toUserRole("root")).toBe("customer");
    expect(isDashboardRole("support")).toBe(true);
    expect(isDashboardRole("customer")).toBe(false);
  });
});
