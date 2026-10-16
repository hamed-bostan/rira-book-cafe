import { describe, expect, it, vi } from "vitest";

import { AdminRevokeError } from "../../../errors/AdminRevokeError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { GrantAdmin } from "../GrantAdmin";
import { RevokeAdmin } from "../RevokeAdmin";
import { TransferOwnership } from "../TransferOwnership";

import type { User, UserRole } from "../../../entities/User";
import type { ITeamNotifier } from "../../../repositories/ITeamNotifier";
import type { IUserRepository, RoleChangeBatch } from "../../../repositories/IUserRepository";

function user(id: string, role: UserRole, name = id): User {
  return { id, phone: id, name, email: null, avatarUrl: null, role };
}

/** An in-memory user table whose `applyRoleChanges` behaves like the real one. */
function repoWith(users: User[]) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const batches: RoleChangeBatch[] = [];
  const repo: IUserRepository = {
    getById: async (id) => byId.get(id) ?? null,
    create: async () => {
      throw new Error("unused");
    },
    update: async () => {
      throw new Error("unused");
    },
    listByRoles: async (roles) => [...byId.values()].filter((u) => roles.includes(u.role)),
    applyRoleChanges: async (batch) => {
      batches.push(batch);
      return batch.assignments.map((a) => {
        const next = { ...(byId.get(a.id) ?? user(a.id, "customer", "Rira Guest")), role: a.role };
        byId.set(a.id, next);
        return next;
      });
    },
  };
  return { repo, batches, byId };
}

function notifier() {
  return {
    adminGranted: vi.fn<ITeamNotifier["adminGranted"]>(async () => {}),
    ownershipReceived: vi.fn<ITeamNotifier["ownershipReceived"]>(async () => {}),
    ownershipLost: vi.fn<ITeamNotifier["ownershipLost"]>(async () => {}),
  } satisfies ITeamNotifier;
}

describe("GrantAdmin", () => {
  it("normalizes +98 numbers to the same id OTP sign-in uses", async () => {
    const { repo, byId } = repoWith([user("owner", "owner")]);
    await new GrantAdmin(repo).execute({ phone: "+98 912 000 0000", role: "staff" }, "owner");
    expect(byId.get("09120000000")?.role).toBe("staff");
  });

  it("records nothing and sends nothing when the role doesn't change", async () => {
    const { repo, batches } = repoWith([user("owner", "owner"), user("09120000000", "staff")]);
    const notify = notifier();
    await new GrantAdmin(repo, notify).execute({ phone: "09120000000", role: "staff" }, "owner", "https://x/login");
    expect(batches[0].entries).toEqual([]);
    expect(notify.adminGranted).not.toHaveBeenCalled();
  });
});

describe("RevokeAdmin", () => {
  it("refuses removing yourself", async () => {
    const { repo } = repoWith([user("a", "admin")]);
    await expect(new RevokeAdmin(repo).execute("a", "a")).rejects.toThrow(AdminRevokeError);
  });

  it("refuses removing the owner", async () => {
    const { repo } = repoWith([user("owner", "owner"), user("a", "admin")]);
    await expect(new RevokeAdmin(repo).execute("owner", "a")).rejects.toMatchObject({ reason: "owner" });
  });

  it("treats a customer as not on the team", async () => {
    const { repo } = repoWith([user("owner", "owner"), user("c", "customer")]);
    await expect(new RevokeAdmin(repo).execute("c", "owner")).rejects.toThrow(NotFoundError);
  });

  it("demotes to customer with an audit entry in the same batch", async () => {
    const { repo, batches } = repoWith([user("owner", "owner"), user("s", "staff")]);
    const result = await new RevokeAdmin(repo).execute("s", "owner");
    expect(result.role).toBe("customer");
    expect(batches[0].entries).toHaveLength(1);
  });
});

describe("TransferOwnership", () => {
  it("promotes the target and demotes the old owner to admin in one batch", async () => {
    const { repo, batches, byId } = repoWith([user("owner", "owner"), user("a", "admin")]);
    const notify = notifier();
    await new TransferOwnership(repo, notify).execute("a", "owner", "https://x/dashboard");

    expect(byId.get("a")?.role).toBe("owner");
    expect(byId.get("owner")?.role).toBe("admin");
    expect(batches).toHaveLength(1);
    expect(notify.ownershipReceived).toHaveBeenCalledTimes(1);
    expect(notify.ownershipLost).toHaveBeenCalledTimes(1);
  });

  it("refuses transferring to yourself when you already own it", async () => {
    const { repo } = repoWith([user("owner", "owner")]);
    await expect(new TransferOwnership(repo).execute("owner", "owner")).rejects.toThrow(AdminRevokeError);
  });
});
