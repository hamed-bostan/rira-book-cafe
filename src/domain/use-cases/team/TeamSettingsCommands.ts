import { diffFields, type ActivityActor } from "../../entities/ActivityEntry";
import { validRetentionMonths, type TeamSettings } from "../../entities/TeamSettings";

import type { ITeamSettingsRepository } from "../../repositories/ITeamSettingsRepository";

/** The id team-wide settings entries carry — there's one set of settings. */
export const TEAM_SETTINGS_ENTITY_ID = "team-settings";

export class GetTeamSettings {
  constructor(private readonly settings: ITeamSettingsRepository) {}

  execute(): Promise<TeamSettings> {
    return this.settings.get();
  }
}

/**
 * The owner changes the team's security settings. Recorded under the team's access
 * with the values before and after; saving what's already set records nothing.
 */
export class UpdateTeamSettings {
  constructor(private readonly settings: ITeamSettingsRepository) {}

  async execute(changes: Partial<TeamSettings>, actor: ActivityActor): Promise<TeamSettings> {
    const clean: Partial<TeamSettings> = {
      ...(changes.activityRetentionMonths !== undefined
        ? { activityRetentionMonths: validRetentionMonths(changes.activityRetentionMonths) }
        : {}),
    };

    return this.settings.update(clean, ({ before, after }) => {
      const diff = diffFields(before, after);
      if (diff.length === 0) return null;
      return {
        actorId: actor.id,
        actorName: actor.name,
        action: "user.securitySettingsChanged",
        entityType: "user",
        entityId: TEAM_SETTINGS_ENTITY_ID,
        changes: diff,
      };
    });
  }
}
