import { changedFields, type NewActivityEntry } from "@/src/domain/entities/ActivityEntry";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";

import type { Prisma } from "@prisma/client";

/**
 * Turn a domain entry into the row `activity_log` stores.
 *
 * One place, so the transactional writers below and `PrismaActivityLog.record`
 * can't drift into storing the same entry differently — in particular
 * `changedFields`, which is derived from the diff and must never be set by hand.
 */
export function toActivityRow(entry: NewActivityEntry) {
  return {
    actorId: entry.actorId,
    actorName: entry.actorName,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel ?? null,
    // Structurally a `[{ field, before, after }]` array of strings/nulls, which is
    // valid input JSON; the cast only satisfies Prisma's Json input type.
    changes: entry.changes as unknown as Prisma.InputJsonValue,
    changedFields: changedFields(entry.changes),
  };
}

/**
 * Run a repository method's audit hook and persist what it returns, using the
 * caller's transaction client.
 *
 * This is the whole mechanism by which an audit entry becomes atomic with the
 * change it describes: `tx` is the interactive transaction the repository method
 * already opened for its own write, so the entry and the change commit together or
 * neither does. There is no window in which one exists without the other, and no
 * failure mode that leaves a mutation unrecorded.
 *
 * A no-op when the caller passed no hook (plenty of writes aren't admin actions)
 * or when the hook returns `null` (nothing changed worth recording).
 *
 * If the hook itself throws, the transaction rolls back and the mutation fails.
 * That is the correct direction to fail in now that the two are atomic: a bug in
 * how an entry is *built* is a bug, and the alternative — swallowing it — would
 * quietly reintroduce exactly the silent-gap problem this arrangement removes.
 */
export async function recordAudit<T>(
  tx: Prisma.TransactionClient,
  result: T,
  audit?: AuditHook<T>,
): Promise<void> {
  if (!audit) return;
  const entry = audit(result);
  if (!entry) return;
  await tx.activityEntry.create({ data: toActivityRow(entry) });
}
