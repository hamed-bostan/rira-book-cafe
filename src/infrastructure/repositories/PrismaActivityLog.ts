import type {
  ActivityActorOption,
  ActivityChange,
  ActivityEntry,
  ActivityFilters,
  ActivitySort,
  NewActivityEntry,
} from "@/src/domain/entities/ActivityEntry";
import {
  DEFAULT_ACTIVITY_DIRECTION,
  toActivityAction,
  toActivityEntityType,
} from "@/src/domain/entities/ActivityEntry";
import type { Page, PageRequest } from "@/src/domain/entities/Pagination";
import { createPage, toSkipTake } from "@/src/domain/entities/Pagination";
import type { IActivityLog } from "@/src/domain/repositories/IActivityLog";
import type { ILogger } from "@/src/domain/repositories/ILogger";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { toActivityRow } from "./writeActivityEntry";

/**
 * The activity log backed by PostgreSQL via Prisma. Server-side only (it opens a
 * DB connection), bound through the container — never imported by client code.
 *
 * Read only for changes. Entries describing a change are written by the
 * repositories that make it, inside the same transaction (see `recordAudit`), so
 * there is no second way into the table for those. No update anywhere, and the only
 * delete is `pruneBefore` — retention by cut-off, which records itself (see the port).
 */
export class PrismaActivityLog implements IActivityLog {
  constructor(private readonly logger: ILogger) {}

  async list(filters: ActivityFilters, page: PageRequest<ActivitySort>): Promise<Page<ActivityEntry>> {
    const where = toWhere(filters);
    // `at` is the only sort the log offers, so the direction is the whole choice.
    const orderBy: Prisma.ActivityEntryOrderByWithRelationInput = {
      createdAt: page.direction ?? DEFAULT_ACTIVITY_DIRECTION,
    };

    const { skip, take } = toSkipTake(page);
    // One transaction so the rows and the total describe the same snapshot — an
    // entry appended between two separate queries would shift the pager under it.
    const [rows, total] = await prisma.$transaction([
      prisma.activityEntry.findMany({ where, orderBy, skip, take }),
      prisma.activityEntry.count({ where }),
    ]);

    return createPage(rows.map(toActivityEntry), total, page);
  }

  async listForEntity(entityType: string, entityId: string, limit: number): Promise<ActivityEntry[]> {
    const rows = await prisma.activityEntry.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toActivityEntry);
  }

  async listActors(visibleEntityTypes?: readonly string[]): Promise<ActivityActorOption[]> {
    // Grouped rather than `findMany({ distinct })`: Prisma applies `distinct`
    // in memory, which would read the whole log to build a dropdown. This is a
    // real SQL GROUP BY, and its result is bounded by the number of distinct
    // (actor, name) pairs — one per person, plus one more each time someone is
    // renamed, since the name is snapshotted on every entry.
    const groups = await prisma.activityEntry.groupBy({
      by: ["actorId", "actorName"],
      where: visibleEntityTypes ? { entityType: { in: [...visibleEntityTypes] } } : undefined,
      _max: { createdAt: true },
    });

    // Collapse a renamed actor's several pairs to one option under their most
    // recent name, so the filter offers each person once.
    const latest = new Map<string, { name: string; at: Date }>();
    for (const group of groups) {
      const at = group._max.createdAt ?? new Date(0);
      const seen = latest.get(group.actorId);
      if (!seen || seen.at < at) latest.set(group.actorId, { name: group.actorName, at });
    }

    return [...latest.entries()].map(([id, { name }]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async *entryBatches(filters: ActivityFilters, batchSize: number): AsyncGenerator<ActivityEntry[]> {
    const where = toWhere(filters);
    let cursor: { createdAt: Date; id: string } | null = null;
    for (;;) {
      const after: Prisma.ActivityEntryWhereInput | null = cursor
        ? {
            OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
          }
        : null;
      const rows: ActivityRow[] = await prisma.activityEntry.findMany({
        where: after ? { AND: [where, after] } : where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: batchSize,
      });
      if (rows.length === 0) return;
      yield rows.map(toActivityEntry);
      if (rows.length < batchSize) return;
      const last: ActivityRow = rows[rows.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }
  }

  async pruneBefore(cutoff: Date, batchSize: number, entry: (deleted: number) => NewActivityEntry): Promise<number> {
    return prisma.$transaction(async (tx) => {
      // The oldest batch first, picked by the `created_at` index. The prune entries
      // themselves age out like any other once they pass the cut-off.
      const doomed = await tx.activityEntry.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
        take: batchSize,
      });
      if (doomed.length === 0) return 0;
      const { count } = await tx.activityEntry.deleteMany({ where: { id: { in: doomed.map((row) => row.id) } } });
      await tx.activityEntry.create({ data: toActivityRow(entry(count)) });
      this.logger.info("Activity log pruned", { deleted: count, cutoff: cutoff.toISOString() });
      return count;
    });
  }
}

/** Translate the domain filters into a Prisma `where`, omitting the absent ones. */
function toWhere(filters: ActivityFilters): Prisma.ActivityEntryWhereInput {
  const and: Prisma.ActivityEntryWhereInput[] = [];
  if (filters.actorId) and.push({ actorId: filters.actorId });
  if (filters.entityType) and.push({ entityType: filters.entityType });
  if (filters.entityId) and.push({ entityId: filters.entityId });
  if (filters.action) and.push({ action: filters.action });
  // Array containment, served by the GIN index on the column.
  if (filters.field) and.push({ changedFields: { has: filters.field } });
  if (filters.from) and.push({ createdAt: { gte: filters.from } });
  if (filters.to) and.push({ createdAt: { lt: filters.to } });
  // A plain ILIKE: the date range and the other filters usually narrow the rows
  // first, and the log of one cafe is small enough that a trigram index isn't
  // worth its write cost on every audited change.
  if (filters.search) {
    const contains = { contains: filters.search, mode: "insensitive" as const };
    and.push({ OR: [{ entityLabel: contains }, { actorName: contains }, { entityId: contains }] });
  }
  // Anded alongside the chosen filters rather than replacing them, so a viewer's
  // permission narrows their query and can never widen it.
  if (filters.visibleEntityTypes) {
    and.push({ entityType: { in: [...filters.visibleEntityTypes] } });
  }
  return and.length ? { AND: and } : {};
}

/**
 * Read the stored diff back into `ActivityChange[]`, dropping anything that isn't
 * shaped like one.
 *
 * `Json` can hold any JSON value, so this is the boundary where a column becomes a
 * typed thing — the same job the response schemas do at the HTTP boundary. A
 * malformed diff costs its entry's *detail*, not the entry: the row still renders
 * with its actor, action and timestamp, which is more than a thrown parse error
 * would leave.
 */
function toChanges(value: Prisma.JsonValue): ActivityChange[] {
  if (!Array.isArray(value)) return [];

  const changes: ActivityChange[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.field !== "string") continue;
    changes.push({
      field: record.field,
      before: typeof record.before === "string" ? record.before : null,
      after: typeof record.after === "string" ? record.after : null,
    });
  }
  return changes;
}

type ActivityRow = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  changes: Prisma.JsonValue;
  createdAt: Date;
};

/** Map a Prisma row to the domain entity, narrowing the stored union strings. */
function toActivityEntry(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorName: row.actorName,
    // The columns are plain strings (the schema is enum-free), so narrow here
    // rather than trusting the database to hold only known values. An entry this
    // build doesn't recognise reads as `unknown` instead of vanishing.
    action: toActivityAction(row.action),
    entityType: toActivityEntityType(row.entityType),
    entityId: row.entityId,
    entityLabel: row.entityLabel ?? undefined,
    changes: toChanges(row.changes),
    at: row.createdAt,
  };
}
