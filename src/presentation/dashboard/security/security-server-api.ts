import { serverApiGet } from "@/src/lib/api/server-client";
import {
  sessionListResponseSchema,
  twoFactorOverviewResponseSchema,
  type SessionWire,
  type TwoFactorOverviewWire,
} from "@/src/presentation/dashboard/team/security-response-schema";

/**
 * Server-side reads of your own sign-in security (BFF): where you're signed in and
 * your authenticator-app two-factor. `serverApiGet` forwards the session cookie, so
 * the endpoints answer for whoever is looking.
 */
export const securityServerApi = {
  listSessions(): Promise<SessionWire[]> {
    return serverApiGet("/admin/me/sessions", sessionListResponseSchema);
  },

  getTwoFactor(): Promise<TwoFactorOverviewWire> {
    return serverApiGet("/admin/me/two-factor", twoFactorOverviewResponseSchema);
  },
};
