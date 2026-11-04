import { describe, expect, it, vi } from "vitest";

import { SESSION_MAX_AGE_MS } from "../../../entities/UserSession";
import { MAX_PRUNE_BATCHES_PER_RUN, PRUNE_BATCH_SIZE, PruneActivityLog, PruneSessions } from "../PruneActivityLog";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { IActivityLog } from "../../../repositories/IActivityLog";

const NOW = new Date("2026-11-04T10:00:00Z");
const settings = (activityRetentionMonths: number | null) => ({
  get: async () => ({ requireTwoFactor: false, activityRetentionMonths }),
});

describe("PruneActivityLog", () => {
  it("does nothing while retention is forever", async () => {
    const pruneBefore = vi.fn<IActivityLog["pruneBefore"]>(async () => 0);
    expect(await new PruneActivityLog({ pruneBefore }, settings(null)).execute(NOW)).toBe(0);
    expect(pruneBefore).not.toHaveBeenCalled();
  });

  it("prunes in batches up to the cut-off, each batch recording itself under the system", async () => {
    const remaining = [PRUNE_BATCH_SIZE, PRUNE_BATCH_SIZE, 17];
    const entries: NewActivityEntry[] = [];
    const pruneBefore = vi.fn<IActivityLog["pruneBefore"]>(async (_cutoff, _size, entry) => {
      const deleted = remaining.shift() ?? 0;
      if (deleted > 0) entries.push(entry(deleted));
      return deleted;
    });

    const total = await new PruneActivityLog({ pruneBefore }, settings(12)).execute(NOW);
    expect(total).toBe(PRUNE_BATCH_SIZE * 2 + 17);
    expect(pruneBefore).toHaveBeenCalledTimes(3);
    expect(pruneBefore.mock.calls[0][0].toISOString()).toBe("2025-11-04T10:00:00.000Z");
    expect(entries[2]).toMatchObject({
      actorId: "system",
      action: "activity.pruned",
      entityType: "activity",
      changes: [
        { field: "entriesRemoved", before: null, after: "17" },
        { field: "olderThan", before: null, after: "2025-11-04" },
        { field: "retentionMonths", before: null, after: "12" },
      ],
    });
  });

  it("stops after a run's worth of batches, leaving the rest for the next run", async () => {
    const pruneBefore = vi.fn<IActivityLog["pruneBefore"]>(async () => PRUNE_BATCH_SIZE);
    await new PruneActivityLog({ pruneBefore }, settings(6)).execute(NOW);
    expect(pruneBefore).toHaveBeenCalledTimes(MAX_PRUNE_BATCHES_PER_RUN);
  });
});

describe("PruneSessions", () => {
  it("clears rows unseen for longer than a session lives", async () => {
    const pruneInactive = vi.fn(async () => 4);
    expect(await new PruneSessions({ pruneInactive }).execute(NOW)).toBe(4);
    expect(pruneInactive).toHaveBeenCalledWith(new Date(NOW.getTime() - SESSION_MAX_AGE_MS), PRUNE_BATCH_SIZE);
  });
});
