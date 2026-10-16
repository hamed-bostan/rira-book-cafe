import { DASHBOARD_ROLES, type User } from "../../entities/User";

import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Everyone who can reach the dashboard: the owner and every admin, plus any
 * break-glass ids the caller passes in.
 *
 * Break-glass access is configured in the environment (see `require-admin.ts`),
 * which the domain can't and shouldn't read — so the ids arrive as an argument.
 * Folding them in here matters because an owner listing "who has access" must see
 * *everyone*, including an account that holds no role in the database; hiding
 * those would make the page quietly lie.
 */
export class ListTeam {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(breakGlassIds: readonly string[] = []): Promise<User[]> {
    const members = await this.userRepo.listByRoles(DASHBOARD_ROLES);
    const seen = new Set(members.map((member) => member.id));

    // A break-glass id may have no user row at all (env set before that person
    // ever signed in). Those simply have nothing to list, so they're skipped
    // rather than synthesised into a half-real member.
    const extras = await Promise.all(
      breakGlassIds.filter((id) => !seen.has(id)).map((id) => this.userRepo.getById(id)),
    );

    return [...members, ...extras.filter((user): user is User => user !== null)];
  }
}
