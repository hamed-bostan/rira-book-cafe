import { AdminRevokeError } from "../../errors/AdminRevokeError";
import { NotFoundError } from "../../errors/NotFoundError";

import { roleChangeEntry } from "./roleChangeEntry";

import type { User } from "../../entities/User";
import type { ITeamNotifier } from "../../repositories/ITeamNotifier";
import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Hand ownership of the cafe to another team member.
 *
 * Exactly one owner exists, so this is a swap rather than a grant: the target
 * becomes `owner` and the outgoing owner steps down to `admin` — they keep
 * running the cafe, they just stop being the account no peer can remove. That
 * also makes this the *only* way to change who the owner is, which is what makes
 * "the owner can't be removed" a safe rule instead of a trap.
 *
 * The promotion, every step-down, and the audit entries for all of them go in as
 * one transaction. That's what makes "exactly one owner" an invariant rather than
 * an aspiration: there is no instant at which a reader could observe two, and no
 * failure that can leave the cafe in that state.
 */
export class TransferOwnership {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly notifier?: ITeamNotifier,
  ) {}

  async execute(targetId: string, actorId: string, dashboardUrl?: string): Promise<User> {
    const actor = await this.userRepo.getById(actorId);

    // Targeting yourself is only meaningless if you already *are* the owner.
    // Otherwise it's a break-glass admin claiming the vacant seat — the bootstrap
    // path for a deployment that has no owner in the database yet. Refusing it
    // outright deadlocked that case: the only route to ownership was to hand it
    // to somebody else.
    if (targetId === actorId && actor?.role === "owner") {
      throw new AdminRevokeError("self", "You already own this cafe.");
    }

    const target = await this.userRepo.getById(targetId);
    if (!target) throw new NotFoundError("user", targetId);

    // Read the incumbents *before* promoting, so the new owner isn't in the set
    // about to be stepped down.
    const incumbents = await this.userRepo.listByRoles(["owner"]);

    // Step down whoever currently holds the role — not merely the caller. Those
    // differ whenever a break-glass admin transfers: their access comes from the
    // environment, so they may hold no role at all while someone else is owner,
    // and demoting only the caller left two owners behind. Written as "demote
    // every owner that isn't the target" so it also repairs a database that has
    // somehow ended up with more than one.
    const outgoing = incumbents.filter((incumbent) => incumbent.id !== target.id);
    const actorName = actor?.name ?? actorId;

    // Every role this moves gets its own audit entry, so the history reads as the
    // pair of facts it is — someone gained ownership, someone else lost it —
    // rather than one event the reader has to infer a second half from.
    const [promoted, ...steppedDown] = await this.userRepo.applyRoleChanges({
      assignments: [
        { id: target.id, phone: target.phone, role: "owner" },
        ...outgoing.map((former) => ({
          id: former.id,
          phone: former.phone,
          role: "admin" as const,
        })),
      ],
      entries: [
        // Repairing a database with several owners re-promotes someone who
        // already held the role; that isn't a change, so it isn't recorded.
        ...(target.role === "owner"
          ? []
          : [
              roleChangeEntry({
                user: target,
                actor: { id: actorId, name: actorName },
                fromRole: target.role,
                toRole: "owner",
              }),
            ]),
        ...outgoing.map((former) =>
          roleChangeEntry({
            user: former,
            actor: { id: actorId, name: actorName },
            fromRole: "owner",
            toRole: "admin",
          }),
        ),
      ],
    });

    // Best-effort, and after every write. Both sides are told: gaining ownership
    // is worth confirming, and losing it is worth *knowing* — this can be taken
    // by anyone with break-glass access, so the outgoing owner shouldn't have to
    // discover it by noticing their own badge changed.
    if (this.notifier && dashboardUrl) {
      const recipient = (user: User) => ({
        name: user.name,
        phone: user.phone,
        email: user.email,
      });

      // Only announce a promotion that actually changed something — repairing a
      // database with several owners re-promotes someone who already held it.
      if (target.role !== "owner") {
        await this.notifier.ownershipReceived(recipient(promoted), dashboardUrl);
      }
      for (const former of steppedDown) {
        await this.notifier.ownershipLost(recipient(former), promoted.name, dashboardUrl);
      }
    }

    return promoted;
  }
}
