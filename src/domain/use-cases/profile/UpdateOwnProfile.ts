import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { User } from "../../entities/User";
import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * A guest sets their own name and email. The name matters beyond vanity: it's
 * snapshotted onto every order and booking they make, which is what staff call
 * out at the counter. The avatar is left as it is.
 */
export class UpdateOwnProfile {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(userId: string, input: { name: string; email: string | null }): Promise<User> {
    const name = input.name.trim();
    if (!name) throw new ValidationError("name", "Your name is required.");

    const current = await this.userRepo.getById(userId);
    if (!current) throw new NotFoundError("user", userId);

    return this.userRepo.update(userId, { name, email: input.email?.trim() || null, avatarUrl: current.avatarUrl });
  }
}
