import { toUserRole } from "./User";

import type { ActivityChange } from "./ActivityEntry";
import type { UserRole } from "./User";

/**
 * How to read a `user.roleChanged` entry out of the activity log.
 *
 * There is no `RoleChange` entity any more: role changes are activity entries
 * like every other admin action, recorded as `action: "user.roleChanged"` with a
 * `role` field in the diff. What's left here is the part that was never storage —
 * turning "customer → admin, by someone else" into the sentence a human reads.
 *
 * That derivation stays derivation rather than becoming a stored `kind` column,
 * for the reason it always did: a second field naming the action can contradict
 * the roles it claims to describe, and then there's no way to tell which one lied.
 */

/** The field the role sits under in a `user.roleChanged` entry's diff. */
export const ROLE_CHANGE_FIELD = "role";

/**
 * What a change amounted to.
 *
 * `ownershipClaimed` and `ownershipTransferred` are both "someone became owner";
 * they differ only in whether the actor was the one promoted. `unknown` covers an
 * entry whose diff doesn't carry a readable role move — a malformed row, which the
 * UI still shows rather than hides.
 */
export type RoleChangeKind =
  | "granted"
  | "revoked"
  | "ownershipTransferred"
  | "ownershipClaimed"
  | "steppedDown"
  | "unknown";

/** The two sides of a role move, pulled out of an entry's diff. */
export type RoleMove = {
  fromRole: UserRole;
  toRole: UserRole;
};

/**
 * Find the role move in an entry's diff, or `null` when there isn't one.
 *
 * Takes the changes rather than a whole entry so it works on the domain entity and
 * on the wire shape alike (which carries `at` as an ISO string).
 */
export function roleMove(changes: readonly ActivityChange[]): RoleMove | null {
  const change = changes.find((candidate) => candidate.field === ROLE_CHANGE_FIELD);
  if (!change) return null;
  return { fromRole: toUserRole(change.before ?? ""), toRole: toUserRole(change.after ?? "") };
}

/**
 * Classify a role move for display. `userId` is who was changed (an entry's
 * `entityId`); `actorId` is who changed them.
 */
export function roleChangeKind(input: {
  userId: string;
  actorId: string;
  changes: readonly ActivityChange[];
}): RoleChangeKind {
  const move = roleMove(input.changes);
  if (!move) return "unknown";

  if (move.toRole === "owner") {
    return input.userId === input.actorId ? "ownershipClaimed" : "ownershipTransferred";
  }
  if (move.fromRole === "owner") return "steppedDown";
  return move.toRole === "customer" ? "revoked" : "granted";
}
