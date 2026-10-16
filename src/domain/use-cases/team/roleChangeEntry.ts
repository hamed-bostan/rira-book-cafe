import { singleChange } from "../../entities/ActivityEntry";
import { ROLE_CHANGE_FIELD } from "../../entities/RoleChange";

import type { ActivityActor, NewActivityEntry } from "../../entities/ActivityEntry";
import type { UserRole } from "../../entities/User";

/**
 * Build the activity entry for one role move.
 *
 * Shared by all three team use-cases so the entries they hand to
 * `applyRoleChanges` are identical in shape — the log is only queryable if
 * `user.roleChanged` means the same thing whether a grant, a revoke or an
 * ownership transfer wrote it.
 */
export function roleChangeEntry(input: {
  /** Whose access changed, with their name at the time. */
  user: { id: string; name: string };
  actor: ActivityActor;
  fromRole: UserRole;
  toRole: UserRole;
}): NewActivityEntry {
  return {
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: "user.roleChanged",
    entityType: "user",
    entityId: input.user.id,
    entityLabel: input.user.name,
    changes: singleChange(ROLE_CHANGE_FIELD, input.fromRole, input.toRole),
  };
}
