import type { NewActivityEntry } from "../entities/ActivityEntry";

/**
 * How a use-case hands a repository the audit entry for the write it's about to
 * make, so the entry commits in the same transaction as the change.
 *
 * A *function* of the persisted result, not a prepared entry, because of an
 * ordering problem that has no other clean answer: the entry describes what the
 * write produced — the id a create was assigned, the values an update actually
 * landed on — so it can't be built until the write has happened, and it has to be
 * persisted before that write commits. Handing the repository a callback lets it
 * invoke this at the one point inside its transaction where both are true.
 *
 * Returning `null` means "nothing worth recording": a save that changed no fields,
 * a status re-applied to the value it already had. The repository writes no entry
 * rather than an empty one, so the log stays a record of changes and not of clicks.
 *
 * Optional everywhere it appears. Plenty of writes through these same methods
 * aren't admin actions at all — checkout decrements stock, a customer cancels an
 * order — and those have no actor to attribute and nothing to say in an admin
 * audit trail.
 *
 * The division of labour this creates is the point, and it's the same one
 * `IUserRepository.applyRoleChanges` has always had: the use-case decides *what*
 * is worth recording and *how it reads*, because that's domain knowledge the
 * repository doesn't have; the repository decides *when* it hits the database,
 * because atomicity is its job and only it knows the transaction boundary.
 */
export type AuditHook<T> = (result: T) => NewActivityEntry | null;
