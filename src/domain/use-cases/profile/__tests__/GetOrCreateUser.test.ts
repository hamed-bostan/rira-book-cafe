import { describe, expect, it, vi } from "vitest";

import { GetOrCreateUser } from "../GetOrCreateUser";

import type { User } from "../../../entities/User";
import type { IUserRepository } from "../../../repositories/IUserRepository";

const IDENTITY = { id: "09120000000", phone: "+989120000000", name: "Rira Guest" };
const NOW = new Date("2026-11-08T09:00:00.000Z");

function setup(existing: User | null): {
  useCase: GetOrCreateUser;
  create: ReturnType<typeof vi.fn<IUserRepository["create"]>>;
  recordFirstSignIn: ReturnType<typeof vi.fn<IUserRepository["recordFirstSignIn"]>>;
} {
  const create = vi.fn<IUserRepository["create"]>(async (input) => ({
    id: input.id,
    phone: input.phone,
    name: input.name,
    email: input.email ?? null,
    avatarUrl: input.avatarUrl ?? null,
    role: "customer",
    firstSignedInAt: input.firstSignedInAt,
  }));
  const recordFirstSignIn = vi.fn<IUserRepository["recordFirstSignIn"]>(async (_id, at) => ({
    ...(existing as User),
    firstSignedInAt: at.toISOString(),
  }));
  const repo = { getById: vi.fn(async () => existing), create, recordFirstSignIn } as unknown as IUserRepository;
  return { useCase: new GetOrCreateUser(repo), create, recordFirstSignIn };
}

describe("GetOrCreateUser", () => {
  it("returns an existing user untouched, keeping their completed profile", async () => {
    const existing: User = {
      id: IDENTITY.id,
      phone: IDENTITY.phone,
      name: "Sara",
      email: "s@x.com",
      avatarUrl: null,
      role: "staff",
      firstSignedInAt: "2026-10-01T09:00:00.000Z",
    };
    const { useCase, create, recordFirstSignIn } = setup(existing);
    expect(await useCase.execute(IDENTITY, NOW)).toBe(existing);
    expect(create).not.toHaveBeenCalled();
    expect(recordFirstSignIn).not.toHaveBeenCalled();
  });

  it("creates the row on first sign-in with a blank profile, signed in now", async () => {
    const { useCase, create } = setup(null);
    const user = await useCase.execute(IDENTITY, NOW);
    expect(create).toHaveBeenCalledWith({
      id: IDENTITY.id,
      phone: IDENTITY.phone,
      name: "Rira Guest",
      email: null,
      avatarUrl: null,
      firstSignedInAt: NOW.toISOString(),
    });
    expect(user.role).toBe("customer");
  });

  it("lands a guest in the profile staff made for them, noting their first sign-in", async () => {
    const madeByStaff: User = {
      id: IDENTITY.id,
      phone: "0912 000 0000",
      name: "Sara Ahmadi",
      email: null,
      avatarUrl: null,
      role: "customer",
      createdById: "09120000003",
    };
    const { useCase, create, recordFirstSignIn } = setup(madeByStaff);
    const user = await useCase.execute(IDENTITY, NOW);
    expect(recordFirstSignIn).toHaveBeenCalledWith(IDENTITY.id, NOW);
    expect(create).not.toHaveBeenCalled();
    expect(user).toMatchObject({ name: "Sara Ahmadi", firstSignedInAt: NOW.toISOString() });
  });
});
