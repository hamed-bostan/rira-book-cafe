import { isCustomRoleKey, type GrantableRole, type UserRole } from "../../entities/User";
import { AdminRevokeError } from "../../errors/AdminRevokeError";
import { ValidationError } from "../../errors/ValidationError";

import type { IRoleRepository } from "../../repositories/IRoleRepository";

/**
 * The two refusals every change to someone's dashboard access shares — granting,
 * changing and revoking a role alike:
 *
 *   - nobody changes their *own* access (someone else should decide what you can
 *     do, and a slip on your own row is the common accident);
 *   - nobody changes the *owner's* role, which only moves by `TransferOwnership`.
 *     Together with the first rule this keeps the invariant the team relies on:
 *     there is always an owner who can reach the dashboard.
 *
 * Split in two so each use-case can keep its own order of checks (the self check
 * needs no read, the owner check needs the target's row). The message says what
 * was attempted; the `reason` is what the API maps to a code.
 */
export function refuseSelf(targetId: string, actorId: string, message: string): void {
  if (targetId === actorId) throw new AdminRevokeError("self", message);
}

export function refuseOwner(targetRole: UserRole | undefined, message: string): void {
  if (targetRole === "owner") throw new AdminRevokeError("owner", message);
}

/**
 * A custom role has to exist to be handed out. Checked here rather than left to
 * the policy (which would quietly give a missing role no permissions) so the owner
 * hears about it — the role was deleted in another tab, say — instead of granting
 * an empty role. Built-in roles always exist.
 */
export async function requireRoleExists(role: GrantableRole, roles: Pick<IRoleRepository, "get">): Promise<void> {
  if (!isCustomRoleKey(role)) return;
  if (!(await roles.get(role))) throw new ValidationError("role", "That role no longer exists.");
}
