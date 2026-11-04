import { SYSTEM_ACTOR } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { activityRetentionCutoff } from "../../entities/TeamSettings";
import { SESSION_MAX_AGE_MS } from "../../entities/UserSession";

import type { IActivityLog } from "../../repositories/IActivityLog";
import type { ISessionRepository } from "../../repositories/ISessionRepository";
import type { ITeamSettingsRepository } from "../../repositories/ITeamSettingsRepository";

/** Entries deleted per transaction — small enough that a first prune of years doesn't hold one long lock. */
export const PRUNE_BATCH_SIZE = 2000;

/**
 * Most batches one run takes. A first prune of a long history spreads over a few
 * runs (every few minutes) rather than keeping one run busy for an hour; the
 * steady state is one small batch a day.
 */
export const MAX_PRUNE_BATCHES_PER_RUN = 25;

/**
 * Enforce the owner's activity retention: delete entries older than the setting,
 * oldest first, in batches. Each batch records its own `activity.pruned` entry in
 * the same transaction (how many went, and the cut-off day), so the log says what
 * was removed and why, and a reader never finds an unexplained gap. Does nothing
 * while retention is "forever" — the default. Resolves how many entries went.
 */
export class PruneActivityLog {
  constructor(
    private readonly log: Pick<IActivityLog, "pruneBefore">,
    private readonly settings: Pick<ITeamSettingsRepository, "get">,
  ) {}

  async execute(now: Date): Promise<number> {
    const { activityRetentionMonths } = await this.settings.get();
    if (activityRetentionMonths === null) return 0;

    const cutoff = activityRetentionCutoff(now, activityRetentionMonths);
    let total = 0;
    for (let batch = 0; batch < MAX_PRUNE_BATCHES_PER_RUN; batch += 1) {
      const deleted = await this.log.pruneBefore(cutoff, PRUNE_BATCH_SIZE, (count) => ({
        actorId: SYSTEM_ACTOR.id,
        actorName: SYSTEM_ACTOR.name,
        action: "activity.pruned",
        entityType: "activity",
        entityId: cafeDayOf(cutoff),
        changes: [
          { field: "entriesRemoved", before: null, after: String(count) },
          { field: "olderThan", before: null, after: cafeDayOf(cutoff) },
          { field: "retentionMonths", before: null, after: String(activityRetentionMonths) },
        ],
      }));
      total += deleted;
      if (deleted < PRUNE_BATCH_SIZE) break;
    }
    return total;
  }
}

/**
 * Clear out session rows nobody can use any more: revoked ones, and ones unseen
 * for longer than a session lives. Their cookies are dead either way, so this is
 * housekeeping — nothing is recorded. Resolves how many went.
 */
export class PruneSessions {
  constructor(private readonly sessions: Pick<ISessionRepository, "pruneInactive">) {}

  execute(now: Date): Promise<number> {
    return this.sessions.pruneInactive(new Date(now.getTime() - SESSION_MAX_AGE_MS), PRUNE_BATCH_SIZE);
  }
}
