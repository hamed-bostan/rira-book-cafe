import type {
  ActivityEntry,
  ActivityFilters,
  ActivitySort,
} from "../../entities/ActivityEntry";
import type { Page, PageRequest } from "../../entities/Pagination";
import type { IActivityLog } from "../../repositories/IActivityLog";

/**
 * One page of the activity log, newest first — what `/dashboard/activity` reads.
 *
 * A blank `entityId` normalises to "no filter" so a hand-edited `?entityId=`
 * behaves like an unfiltered page, the same rule `ListReviews` applies to its
 * search term. An `entityId` without an `entityType` is dropped rather than
 * honoured: ids are only unique within a type, so the pair is the filter and half
 * of it would match whatever happened to share the string.
 */
export class ListActivity {
  constructor(private readonly log: IActivityLog) {}

  execute(filters: ActivityFilters, page: PageRequest<ActivitySort>): Promise<Page<ActivityEntry>> {
    const entityId = filters.entityId?.trim() || undefined;
    return this.log.list(
      { ...filters, entityId: filters.entityType ? entityId : undefined },
      page,
    );
  }
}
