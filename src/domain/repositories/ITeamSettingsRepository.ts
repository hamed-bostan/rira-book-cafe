import type { AuditHook } from "./AuditHook";
import type { TeamSettings } from "../entities/TeamSettings";

/**
 * The owner's team-wide settings. Implementations may cache them, and drop the
 * cache on every write.
 */
export type ITeamSettingsRepository = {
  get(): Promise<TeamSettings>;
  /** Save the settings, recording `audit` in the same transaction. Resolves them as saved. */
  update(
    changes: Partial<TeamSettings>,
    audit?: AuditHook<{ before: TeamSettings; after: TeamSettings }>,
  ): Promise<TeamSettings>;
};
