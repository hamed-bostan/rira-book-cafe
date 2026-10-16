import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Permission } from "@/src/domain/entities/Permission";
import { roleHasPermission, ROLE_PERMISSIONS } from "@/src/domain/entities/Permission";
import { isDashboardRole, type UserRole } from "@/src/domain/entities/User";
import { userRepository } from "@/src/infrastructure/container";

import type { Session } from "next-auth";

/**
 * The authorization boundary: everything that guards a dashboard route or an admin
 * endpoint goes through here.
 *
 * The question every guard asks is "may this session do X?", never "is this an
 * admin?". That distinction is the whole point of the rewrite: a call site asking
 * about a *role* has to be revisited every time the set of roles changes, and this
 * app just went from two dashboard roles to four. A call site asking about a
 * permission never does — adding a role is an edit to `ROLE_PERMISSIONS` and
 * nothing else.
 *
 * The role is read from the database on every check rather than carried in the
 * session JWT. That costs one indexed lookup per dashboard request — dashboard
 * traffic is a rounding error next to the storefront — and buys instant
 * revocation: a demoted user loses access on their next request instead of
 * whenever their token happens to expire.
 */

/**
 * Parse the comma-separated `ADMIN_USER_IDS` allowlist into a Set.
 *
 * This is the break-glass path, not the normal one: access lives on the user's
 * `role` in the database and is managed from the dashboard's team page. The
 * allowlist survives so an owner can always get back in — if the last owner is
 * demoted, or the team table is wrong, setting this env var restores access
 * without a database console. Ids here are *not* revocable through the UI.
 */
function breakGlassIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

/** True when the id is an unrevocable break-glass owner from the environment. */
export function isBreakGlassAdmin(userId: string): boolean {
  return breakGlassIds().has(userId);
}

/**
 * The configured break-glass ids, for callers that must fold them into a listing
 * of who has access (see `ListAdmins`) — the domain can't read the environment.
 */
export function breakGlassAdminIds(): string[] {
  return [...breakGlassIds()];
}

/**
 * The effective role of a session, or `null` when signed out.
 *
 * Break-glass ids resolve to `owner`: the allowlist exists to bootstrap the first
 * owner and to recover a lost one, so it has to be the *most* privileged answer or
 * it can't do either job. That was already true when the check was a boolean; it's
 * just now expressible.
 */
export async function sessionRole(session: Session | null): Promise<UserRole | null> {
  const userId = session?.user?.id;
  if (!userId) return null;
  if (isBreakGlassAdmin(userId)) return "owner";

  const user = await userRepository.getById(userId);
  return user?.role ?? null;
}

/** Whether a session carries a permission. The single question every guard asks. */
export async function sessionHas(session: Session | null, permission: Permission): Promise<boolean> {
  const role = await sessionRole(session);
  return role != null && roleHasPermission(role, permission);
}

/**
 * Non-redirecting guard for route handlers, which must answer with a JSON status
 * code rather than an HTML redirect (a `fetch` caller can't follow a login
 * redirect). Returns the session when it carries `permission`, or `null` — the
 * caller answers 401.
 *
 * Returning the session rather than a boolean is deliberate: almost every guarded
 * handler needs the actor for the activity entry it writes, and a guard that only
 * said yes/no would leave each one calling `auth()` a second time.
 */
export async function getSessionWith(permission: Permission): Promise<Session | null> {
  const session = await auth();
  return (await sessionHas(session, permission)) ? session : null;
}

/**
 * Server-side guard for a dashboard *page*. Returns the session when it carries
 * `permission`. Anonymous visitors go to `/login` (with a `callbackUrl`); signed-in
 * users without the permission are sent somewhere they belong rather than shown a
 * 404 or a 401 — the dashboard's existence isn't leaked to a customer, and a staff
 * member who wandered onto the promo-codes page is bounced to the dashboard root
 * instead of into an error boundary.
 */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (!(await sessionHas(session, permission))) {
    // A user who belongs in the dashboard but not on this page goes to the root;
    // everyone else goes to the storefront.
    const role = await sessionRole(session);
    redirect(role != null && isDashboardRole(role) ? "/dashboard" : "/");
  }

  return session;
}

/**
 * The permissions a session holds, for the presentation layer.
 *
 * The sidebar and the detail screens need to know what to *offer* — a button that
 * can only 401 is worse than no button. This is that answer, computed once per
 * render and passed down, so a screen never re-asks per control.
 *
 * It is emphatically not the authorization. Every endpoint checks for itself; this
 * only decides what gets drawn.
 */
export async function sessionPermissions(session: Session | null): Promise<readonly Permission[]> {
  const role = await sessionRole(session);
  return role == null ? [] : ROLE_PERMISSIONS[role];
}
