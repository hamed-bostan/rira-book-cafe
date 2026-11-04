import { DEFAULT_TEAM_SETTINGS, type TeamSettings } from "@/src/domain/entities/TeamSettings";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { ITeamSettingsRepository } from "@/src/domain/repositories/ITeamSettingsRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { recordAudit } from "./writeActivityEntry";

/** As for the role policy: writes here drop the cache at once; this bounds a second instance. */
const SETTINGS_TTL_MS = 30_000;

const cacheRegistry = globalThis as typeof globalThis & {
  __teamSettingsCache?: { value: { settings: TeamSettings; loadedAt: number } | null };
};
const settingsCache = (cacheRegistry.__teamSettingsCache ??= { value: null });

/** The team's settings row in PostgreSQL via Prisma, cached per process (see the port). */
export class PrismaTeamSettingsRepository implements ITeamSettingsRepository {
  constructor(private readonly clock: () => number = Date.now) {}

  async get(): Promise<TeamSettings> {
    const cached = settingsCache.value;
    if (cached && this.clock() - cached.loadedAt < SETTINGS_TTL_MS) return cached.settings;
    const loadedAt = this.clock();
    const row = await prisma.teamSettings.findUnique({ where: { id: 1 } });
    const settings = row
      ? { requireTwoFactor: row.requireTwoFactor, activityRetentionMonths: row.activityRetentionMonths }
      : DEFAULT_TEAM_SETTINGS;
    settingsCache.value = { settings, loadedAt };
    return settings;
  }

  async update(
    changes: Partial<TeamSettings>,
    audit?: AuditHook<{ before: TeamSettings; after: TeamSettings }>,
  ): Promise<TeamSettings> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Row-locked read: two owners' tabs saving at once can't both diff against the same "before".
        const locked = await tx.$queryRaw<{ requireTwoFactor: boolean; activityRetentionMonths: number | null }[]>`
          SELECT "require_two_factor" AS "requireTwoFactor", "activity_retention_months" AS "activityRetentionMonths"
          FROM "team_settings" WHERE "id" = 1 FOR UPDATE`;
        const before: TeamSettings = locked[0] ?? DEFAULT_TEAM_SETTINGS;
        const after: TeamSettings = { ...before, ...changes };
        await tx.teamSettings.upsert({
          where: { id: 1 },
          update: after,
          create: { id: 1, ...after },
        });
        await recordAudit(tx, { before, after }, audit);
        return after;
      });
    } finally {
      invalidateTeamSettings();
    }
  }
}

/** Drop the cached settings (every write does; tests restoring the database do too). */
export function invalidateTeamSettings(): void {
  settingsCache.value = null;
}
