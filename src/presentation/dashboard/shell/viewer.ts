import type { UserRole } from "@/src/domain/entities/User";
import { ApiError } from "@/src/lib/api/ApiError";

import { viewerServerApi } from "./viewer-server-api";

/**
 * Who is looking at the dashboard, as far as the chrome is concerned.
 *
 * Resolved once in the layout and handed down, so the sidebar's user card and the
 * top bar's menu can never disagree about the name or the role they show. It is
 * display data — the role here decides what is *drawn*, never what is allowed.
 */
export type DashboardViewer = {
  /** The session's user id — keys the command palette's per-user recent searches. */
  id: string;
  /** Display name, already fallen back to something printable by the layout. */
  name: string;
  /** Shown under the name in the menu; absent for a phone-only account. */
  email: string | null;
  /** Profile photo, when the account has one. */
  imageUrl: string | null;
  /** The effective role, labelled from the `dashTeam.roles` catalog. */
  role: UserRole;
};

/**
 * Builds the viewer the chrome draws, reading its own record over the BFF
 * (`GET /api/admin/me`) rather than the repository — a Server Component reads
 * like any other client of the API, same as every other dashboard screen.
 * `viewerServerApi` forwards the session cookie the layout's own
 * `requirePermission` already verified, so the endpoint resolves the same user.
 *
 * Returns `null` only when the account has vanished between the permission
 * check and this call (e.g. deleted mid-session — the endpoint 404s); the
 * layout has no sensible chrome to draw for that and falls back to the door.
 */
export async function dashboardViewerFor(): Promise<DashboardViewer | null> {
  try {
    return await viewerServerApi.get();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return null;
    throw error;
  }
}
