import { z } from "zod/mini";

import { PERMISSIONS, type Permission } from "@/src/domain/entities/Permission";
import { isCustomRoleKey, type CustomRoleKey, type GrantableBuiltInRole } from "@/src/domain/entities/User";

/**
 * What the team-security endpoints promise, as the client receives them: roles,
 * the team's settings, signed-in sessions and a user's two-factor. Only the
 * frontend reads these shapes; the routes build them from the domain.
 */

const roleKey = z.custom<GrantableBuiltInRole | CustomRoleKey>(
  (value) =>
    value === "support" ||
    value === "staff" ||
    value === "admin" ||
    (typeof value === "string" && isCustomRoleKey(value)),
);

export const roleResponseSchema = z.object({
  key: roleKey,
  builtIn: z.boolean(),
  name: z.nullable(z.object({ en: z.string(), fa: z.string() })),
  permissions: z.array(z.enum(PERMISSIONS as unknown as [Permission, ...Permission[]])),
  memberCount: z.number(),
});

export const roleListResponseSchema = z.array(roleResponseSchema);

/** One role on the roles tab. */
export type RoleWire = z.infer<typeof roleResponseSchema>;

export const teamSettingsResponseSchema = z.object({
  requireTwoFactor: z.boolean(),
  activityRetentionMonths: z.nullable(z.number()),
  /** Whether the server has its encryption key, so two-factor can be used at all. */
  twoFactorAvailable: z.boolean(),
});

export type TeamSettingsWire = z.infer<typeof teamSettingsResponseSchema>;

export const sessionResponseSchema = z.object({
  id: z.string(),
  device: z.object({
    browser: z.nullable(z.string()),
    os: z.nullable(z.string()),
    kind: z.enum(["mobile", "tablet", "desktop", "unknown"]),
  }),
  signedInAt: z.string(),
  lastSeenAt: z.string(),
  current: z.boolean(),
});

export const sessionListResponseSchema = z.array(sessionResponseSchema);

/** One signed-in browser. */
export type SessionWire = z.infer<typeof sessionResponseSchema>;

export const twoFactorOverviewResponseSchema = z.object({
  state: z.enum(["off", "pending", "on"]),
  enabledAt: z.nullable(z.string()),
  recoveryCodesLeft: z.number(),
  available: z.boolean(),
  required: z.boolean(),
  /** Where this browser stands at the dashboard's door. */
  gate: z.enum(["ok", "verify", "enroll"]),
});

export type TwoFactorOverviewWire = z.infer<typeof twoFactorOverviewResponseSchema>;

export const twoFactorSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
  qrCode: z.string(),
});

export type TwoFactorSetupWire = z.infer<typeof twoFactorSetupResponseSchema>;

export const recoveryCodesResponseSchema = z.object({ recoveryCodes: z.array(z.string()) });
