import { describe, expect, it, vi } from "vitest";

import { GetOrCreateUser } from "../GetOrCreateUser";

import type { User } from "../../../entities/User";
import type { IUserRepository } from "../../../repositories/IUserRepository";

const IDENTITY = { id: "09120000000", phone: "+989120000000", name: "Rira Guest" };

function setup(existing: User | null): {
  useCase: GetOrCreateUser;
  create: ReturnType<typeof vi.fn<IUserRepository["create"]>>;
} {
  const create = vi.fn<IUserRepository["create"]>(async (input) => ({
    id: input.id,
    phone: input.phone,
    name: input.name,
    email: input.email ?? null,
    avatarUrl: input.avatarUrl ?? null,
    role: "customer",
  }));
  const repo = { getById: vi.fn(async () => existing), create } as unknown as IUserRepository;
  return { useCase: new GetOrCreateUser(repo), create };
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
    };
    const { useCase, create } = setup(existing);
    expect(await useCase.execute(IDENTITY)).toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the row on first sign-in with a blank profile", async () => {
    const { useCase, create } = setup(null);
    const user = await useCase.execute(IDENTITY);
    expect(create).toHaveBeenCalledWith({
      id: IDENTITY.id,
      phone: IDENTITY.phone,
      name: "Rira Guest",
      email: null,
      avatarUrl: null,
    });
    expect(user.role).toBe("customer");
  });
});
