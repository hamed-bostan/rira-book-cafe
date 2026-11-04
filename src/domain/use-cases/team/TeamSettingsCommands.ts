import { diffFields, type ActivityActor } from "../../entities/ActivityEntry";
import { validRetentionMonths, type TeamSettings } from "../../entities/TeamSettings";
import { ConflictError } from "../../errors/ConflictError";

import type { ITeamSettingsRepository } from "../../repositories/ITeamSettingsRepository";
import type { ITwoFactorCrypto } from "../../repositories/ITwoFactorCrypto";

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
  constructor(
    private readonly settings: ITeamSettingsRepository,
    private readonly crypto: Pick<ITwoFactorCrypto, "available">,
  ) {}

  async execute(changes: Partial<TeamSettings>, actor: ActivityActor): Promise<TeamSettings> {
    // Requiring something nobody can set up would only lock the team out of the
    // dashboard's setup screen, so it's refused until the server has its key.
    if (changes.requireTwoFactor && !this.crypto.available) {
      throw new ConflictError("TWO_FACTOR_UNAVAILABLE", "Two-factor isn't set up on this server.");
    }
    const clean: Partial<TeamSettings> = {
      ...(changes.requireTwoFactor !== undefined ? { requireTwoFactor: changes.requireTwoFactor } : {}),
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
