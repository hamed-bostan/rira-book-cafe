import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { UpdateOwnProfile } from "../UpdateOwnProfile";

import type { User } from "../../../entities/User";
import type { IUserRepository, ProfileUpdate } from "../../../repositories/IUserRepository";

const USER: User = {
  id: "0912",
  phone: "0912",
  name: "Rira Guest",
  email: null,
  avatarUrl: "https://x/a.png",
  role: "customer",
};

function repo() {
  const update = vi.fn(async (_id: string, input: ProfileUpdate) => ({ ...USER, ...input }));
  return { repo: { getById: vi.fn(async () => USER), update } as unknown as IUserRepository, update };
}

describe("UpdateOwnProfile", () => {
  it("trims, blanks an empty email, and keeps the avatar", async () => {
    const { repo: r, update } = repo();
    await new UpdateOwnProfile(r).execute("0912", { name: "  Sara  ", email: "  " });
    expect(update).toHaveBeenCalledWith("0912", { name: "Sara", email: null, avatarUrl: "https://x/a.png" });
  });

  it("requires a name", async () => {
    await expect(new UpdateOwnProfile(repo().repo).execute("0912", { name: " ", email: null })).rejects.toThrow(
      ValidationError,
    );
  });
});
