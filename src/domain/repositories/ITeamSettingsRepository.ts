import type { AuditHook } from "./AuditHook";
import type { TeamSettings } from "../entities/TeamSettings";

/**
 * The owner's team-wide settings. Read on every dashboard request (does this
 * cafe require two-factor?), so implementations cache it and drop the cache on
 * every write.
 */
export type ITeamSettingsRepository = {
  get(): Promise<TeamSettings>;
  /** Save the settings, recording `audit` in the same transaction. Resolves them as saved. */
  update(
    changes: Partial<TeamSettings>,
    audit?: AuditHook<{ before: TeamSettings; after: TeamSettings }>,
  ): Promise<TeamSettings>;
};
