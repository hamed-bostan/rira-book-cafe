import { serverApiGet } from "@/src/lib/api/server-client";
import {
  sessionListResponseSchema,
  type SessionWire,
} from "@/src/presentation/dashboard/team/security-response-schema";

/**
 * Server-side reads of your own sign-in security (BFF): where you're signed in.
 * `serverApiGet` forwards the session cookie, so the endpoint answers for whoever
 * is looking.
 */
export const securityServerApi = {
  listSessions(): Promise<SessionWire[]> {
    return serverApiGet("/admin/me/sessions", sessionListResponseSchema);
  },
};
