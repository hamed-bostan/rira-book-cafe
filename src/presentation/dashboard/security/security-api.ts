import type { SecondFactorInput, TwoFactorCodeInput } from "@/src/contracts/team-security-schema";
import { apiDelete, apiPost } from "@/src/lib/api/client";
import {
  recoveryCodesResponseSchema,
  twoFactorSetupResponseSchema,
  type TwoFactorSetupWire,
} from "@/src/presentation/dashboard/team/security-response-schema";

/**
 * Typed client for your own sign-in security: setting up and passing the
 * authenticator-app check, and signing your browsers out. Callers
 * `router.refresh()` (or navigate) after, so the server stays the source of truth.
 */
export const securityApi = {
  /** A new secret to scan; nothing is on until `enable` confirms it with a code. */
  startTwoFactorSetup(): Promise<TwoFactorSetupWire> {
    return apiPost("/admin/me/two-factor/setup", {}, twoFactorSetupResponseSchema);
  },

  /** Confirm with the app's first code. Resolves the recovery codes — shown once, never again. */
  async enableTwoFactor(values: TwoFactorCodeInput): Promise<string[]> {
    return (await apiPost("/admin/me/two-factor/enable", values, recoveryCodesResponseSchema)).recoveryCodes;
  },

  /** Pass the check in this browser. */
  verifyTwoFactor(values: SecondFactorInput): Promise<void> {
    return apiPost("/admin/me/two-factor/verify", values);
  },

  disableTwoFactor(values: SecondFactorInput): Promise<void> {
    return apiPost("/admin/me/two-factor/disable", values);
  },

  revokeSession(sessionId: string): Promise<void> {
    return apiDelete(`/admin/me/sessions/${encodeURIComponent(sessionId)}`);
  },

  /** Every browser but this one. */
  revokeOtherSessions(): Promise<void> {
    return apiDelete("/admin/me/sessions");
  },
};
