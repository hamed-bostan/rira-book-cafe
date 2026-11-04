import { isDashboardRole, type User } from "../../entities/User";
import { NotFoundError } from "../../errors/NotFoundError";

import { roleChangeEntry } from "./roleChangeEntry";
import { refuseOwner, refuseSelf } from "./teamGuards";

import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Demote a team member back to a regular customer. The account itself is
 * untouched — their orders, addresses and profile survive; only dashboard access
 * is withdrawn.
 *
 * Two refusals:
 *   - you can't revoke *yourself* (a slip on your own row is the common accident,
 *     and someone else should be the one to remove you);
 *   - you can't revoke the *owner*, who must hand ownership on first (see
 *     `TransferOwnership`).
 *
 * There is deliberately no "last admin" rule any more. It existed to stop the
 * dashboard becoming unreachable, and the owner now guarantees that: only an
 * owner can revoke, and an owner can't revoke themselves, so someone with access
 * always remains. That invariant is far easier to hold than a count.
 */
export class RevokeAdmin {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(id: string, actorId: string): Promise<User> {
    refuseSelf(id, actorId, "You can't remove your own access.");

    const target = await this.userRepo.getById(id);
    if (!target || !isDashboardRole(target.role)) {
      throw new NotFoundError("team member", id);
    }

    refuseOwner(target.role, "You can't remove the owner. Transfer ownership to someone else first.");

    const actor = await this.userRepo.getById(actorId);
    const [demoted] = await this.userRepo.applyRoleChanges({
      assignments: [{ id: target.id, phone: target.phone, role: "customer" }],
      entries: [
        roleChangeEntry({
          user: target,
          actor: { id: actorId, name: actor?.name ?? actorId },
          fromRole: target.role,
          toRole: "customer",
        }),
      ],
      // Removing access ends every browser they're signed in on, there and then —
      // not merely the dashboard (which the role re-read already closes) but the
      // session itself, so nothing signed in under their old role lingers.
      revokeSessionsOf: [target.id],
    });

    return demoted;
  }
}
