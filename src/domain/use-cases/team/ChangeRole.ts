import { isDashboardRole, type GrantableRole, type User } from "../../entities/User";
import { NotFoundError } from "../../errors/NotFoundError";

import { roleChangeEntry } from "./roleChangeEntry";
import { refuseOwner, refuseSelf, requireRoleExists } from "./teamGuards";

import type { IRoleRepository } from "../../repositories/IRoleRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Move a team member to another job — support, staff, admin or a custom role —
 * without taking their access away.
 *
 * The same two refusals as `RevokeAdmin`, for the same reasons: you can't change
 * *yourself* (someone else should decide what you can do), and you can't change
 * the *owner*, whose role only moves by `TransferOwnership`. Someone who isn't on
 * the team has no role to change — granting them one is `GrantAdmin`.
 *
 * Their signed-in sessions end with the change, so they come back in under the new
 * role rather than carrying on in a browser that was signed in for the old one.
 *
 * Choosing the role they already hold is a no-op: nothing is written and nothing
 * is recorded, since the log tracks changes, not clicks.
 */
export class ChangeRole {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly roles: Pick<IRoleRepository, "get">,
  ) {}

  async execute(id: string, role: GrantableRole, actorId: string): Promise<User> {
    refuseSelf(id, actorId, "You can't change your own role.");

    const target = await this.userRepo.getById(id);
    if (!target || !isDashboardRole(target.role)) {
      throw new NotFoundError("team member", id);
    }

    refuseOwner(target.role, "You can't change the owner's role. Transfer ownership to someone else first.");

    if (target.role === role) return target;
    await requireRoleExists(role, this.roles);

    const actor = await this.userRepo.getById(actorId);
    const [changed] = await this.userRepo.applyRoleChanges({
      assignments: [{ id: target.id, phone: target.phone, role }],
      entries: [
        roleChangeEntry({
          user: target,
          actor: { id: actorId, name: actor?.name ?? actorId },
          fromRole: target.role,
          toRole: role,
        }),
      ],
      revokeSessionsOf: [target.id],
    });

    return changed;
  }
}
