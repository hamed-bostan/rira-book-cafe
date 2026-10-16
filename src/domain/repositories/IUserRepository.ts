import type { NewActivityEntry } from "../entities/ActivityEntry";
import type { User, UserRole } from "../entities/User";

/** One user's new access level, as part of a {@link RoleChangeBatch}. */
export type RoleAssignment = {
  id: string;
  phone: string;
  role: UserRole;
  /**
   * Fills a *blank* address so an invitation has somewhere to go; never
   * overwrites one the user set on their own profile.
   */
  email?: string | null;
};

/**
 * A set of role assignments and the audit entries describing them, applied as one
 * unit.
 *
 * Batched rather than applied one call at a time because the interesting
 * operations aren't single writes. Transferring ownership promotes one person and
 * demotes another, and "exactly one owner" is only true if those land together —
 * applied separately, a failure between them leaves two. The audit entries ride
 * along for the same reason: a record that can be lost independently of the
 * change it describes isn't a record.
 *
 * The entries are ordinary `activity_log` rows (`user.roleChanged`), the same log
 * every other admin change lands in — role changes just keep a stronger guarantee
 * than the rest, because here the log and the change share a transaction. See
 * `IActivityLog` for why the others can't.
 */
export type RoleChangeBatch = {
  assignments: RoleAssignment[];
  entries: NewActivityEntry[];
};

/** A user about to be created — the id is the caller's stable identifier (phone digits). */
export type NewUser = {
  id: string;
  phone: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
};

/** The mutable slice of a profile a user can edit. Phone/id are identity and never change here. */
export type ProfileUpdate = {
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

export type IUserRepository = {
  getById(id: string): Promise<User | null>;
  create(input: NewUser): Promise<User>;
  update(id: string, input: ProfileUpdate): Promise<User>;
  /** Every user holding one of `roles`, oldest first — the team is small enough to read whole. */
  listByRoles(roles: readonly UserRole[]): Promise<User[]>;
  /**
   * Apply a batch of role changes and their audit entries atomically — all of it
   * commits or none of it does.
   *
   * Rows are created for people who haven't signed in yet: access can be granted
   * before a first sign-in, and the row they'd have been given at sign-in is
   * simply written early (see `GrantAdmin`).
   *
   * Resolves the users as written, in the order they were assigned.
   */
  applyRoleChanges(batch: RoleChangeBatch): Promise<User[]>;
};
