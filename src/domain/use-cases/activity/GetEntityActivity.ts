import { clampActivityLimit } from "../../entities/ActivityEntry";

import type { ActivityEntityType, ActivityEntry } from "../../entities/ActivityEntry";
import type { IActivityLog } from "../../repositories/IActivityLog";

/**
 * One entity's own history, newest first — what the activity panel on the order
 * and product detail screens reads.
 *
 * The limit is clamped here rather than in the route so every caller gets the
 * guard, including one that passes a number straight from a query string (see
 * `clampActivityLimit`).
 */
export class GetEntityActivity {
  constructor(private readonly log: IActivityLog) {}

  execute(
    entityType: ActivityEntityType,
    entityId: string,
    limit?: number,
  ): Promise<ActivityEntry[]> {
    return this.log.listForEntity(entityType, entityId, clampActivityLimit(limit));
  }
}
