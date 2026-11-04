import type { ActivityEntry, ActivityFilters } from "../../entities/ActivityEntry";
import type { IActivityLog } from "../../repositories/IActivityLog";

/** Entries read per batch while streaming an export. */
export const EXPORT_BATCH_SIZE = 500;

/**
 * Every entry the filters match, newest first, for a CSV download — the same
 * filters (and the same visibility restriction, which the caller sets on
 * `visibleEntityTypes`) as the page the export was asked from, so the file holds
 * exactly what the reader could page through, all of it.
 *
 * Applies `ListActivity`'s rule for `entityId`: only meaningful with an entity type.
 */
export class ExportActivity {
  constructor(private readonly log: Pick<IActivityLog, "entryBatches">) {}

  execute(filters: ActivityFilters): AsyncIterable<ActivityEntry[]> {
    const entityId = filters.entityId?.trim() || undefined;
    return this.log.entryBatches(
      { ...filters, entityId: filters.entityType ? entityId : undefined },
      EXPORT_BATCH_SIZE,
    );
  }
}
