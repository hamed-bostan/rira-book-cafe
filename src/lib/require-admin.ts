import { getSessionWith, requirePermission, sessionHas } from "./require-permission";

import type { Session } from "next-auth";

/**
 * Owner-specific guards, kept under their own names because "owner" is a real
 * concept in this app rather than a permission bundle: it is the one account no
 * peer can remove, and exactly one exists.
 *
 * Everything else that used to live here — `isAdmin`, `getAdminSession`,
 * `requireAdmin`, and the break-glass helpers — moved to `require-permission.ts`.
 * Guards now ask what a session may *do* (`team.manage`, `catalog.write`) rather
 * than what it is called, so adding a role is an edit to `ROLE_PERMISSIONS` and not
 * a sweep through every handler. These three are that same question, phrased in the
 * vocabulary the team feature already speaks.
 */

/**
 * True when the session may manage the team — the `owner` role, or a break-glass
 * id from the environment.
 *
 * Break-glass counts here on purpose: it's what bootstraps the first owner. A
 * fresh deployment has no owner in the database, so without this nobody could ever
 * appoint one and team management would deadlock on its own rule. It's also the
 * recovery path if the owner's account is ever lost.
 */
export async function isOwner(session: Session | null): Promise<boolean> {
  return sessionHas(session, "team.manage");
}

/**
 * Non-redirecting owner guard for the team route handlers. Returns the session for
 * an owner, or `null` otherwise — the caller answers 401.
 */
export async function getOwnerSession(): Promise<Session | null> {
  return getSessionWith("team.manage");
}

/**
 * Server-side guard for the team page. Anyone with dashboard access who isn't the
 * owner is sent back to the dashboard root rather than shown a 401 — they
 * legitimately belong in the dashboard, just not on this page, so a redirect reads
 * better than an error boundary.
 */
export async function requireOwner(): Promise<Session> {
  return requirePermission("team.manage");
}
