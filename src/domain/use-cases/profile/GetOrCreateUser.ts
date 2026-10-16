import type { User } from "../../entities/User";
import type { AuthIdentity } from "../../repositories/IAuthRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Resolve the persisted profile for an authenticated identity, creating the row
 * on first sign-in. Idempotent: an existing user is returned untouched (so a
 * completed profile is never clobbered by the sign-in placeholder name).
 *
 * Used both when a session is minted (auth `authorize`) and when reading the
 * profile (`GET /api/profile`), so a user who signed in before this table
 * existed is backfilled on their next read rather than 404ing.
 */
export class GetOrCreateUser {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(identity: AuthIdentity): Promise<User> {
    const existing = await this.userRepo.getById(identity.id);
    if (existing) return existing;

    return this.userRepo.create({
      id: identity.id,
      phone: identity.phone,
      name: identity.name,
      email: null,
      avatarUrl: null,
    });
  }
}
