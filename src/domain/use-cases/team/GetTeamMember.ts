import { isDashboardRole, type User } from "../../entities/User";
import { NotFoundError } from "../../errors/NotFoundError";

import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * One member of the team, for the owner's per-member screens (their sessions,
 * their two-factor). Someone who isn't on the team is a `NotFoundError`: the owner
 * manages the team's access, not every guest's account. Break-glass ids count as
 * team, as they do on the team list — the domain can't read the environment, so the
 * caller says whether the id is one.
 */
export class GetTeamMember {
  constructor(private readonly users: Pick<IUserRepository, "getById">) {}

  async execute(id: string, isBreakGlass = false): Promise<User> {
    const user = await this.users.getById(id);
    if (!user || (!isDashboardRole(user.role) && !isBreakGlass)) throw new NotFoundError("team member", id);
    return user;
  }
}
