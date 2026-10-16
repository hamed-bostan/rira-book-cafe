import type { ActivityActorOption, ActivityEntityType } from "../../entities/ActivityEntry";
import type { IActivityLog } from "../../repositories/IActivityLog";

/**
 * The people who appear in the activity log, for the actor filter's dropdown.
 *
 * Drawn from the log rather than from the current team: someone whose access was
 * revoked last month still has entries, and reviewing what they did before they
 * left is one of the main reasons to open this page. A dropdown built from the
 * team table would offer everyone except the person being looked for.
 */
export class ListActivityActors {
  constructor(private readonly log: IActivityLog) {}

  execute(visibleEntityTypes?: readonly ActivityEntityType[]): Promise<ActivityActorOption[]> {
    return this.log.listActors(visibleEntityTypes);
  }
}
