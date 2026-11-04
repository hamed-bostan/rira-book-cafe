import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import type { Permission } from "@/src/domain/entities/Permission";
import type { RolePolicy } from "@/src/domain/entities/Role";
import { isDashboardRole, type UserRole } from "@/src/domain/entities/User";
import { roleRepository, userRepository } from "@/src/infrastructure/container";
import { getEnv } from "@/src/lib/env";

import type { Session } from "next-auth";

/**
 * The authorization boundary: everything that guards a dashboard route or an admin
 * endpoint goes through here.
 *
 * The question every guard asks is "may this session do X?", never "is this an
 * admin?". A call site asking about a *role* has to be revisited every time the set
 * of roles changes — and the owner now edits roles and makes their own from the team
 * page. A call site asking about a permission never does.
 *
 * The role is read from the database on every request rather than carried in the
 * session JWT, and what the role may do comes from the role policy (cached, and
 * dropped the moment the owner edits a role). That costs one indexed lookup per
 * dashboard request — dashboard traffic is a rounding error next to the storefront
 * — and buys instant revocation: a demoted user loses access on their next request
 * instead of whenever their token happens to expire. Within one server render the
 * lookups are shared (`cache`), so the layout, the page and every guard ask once.
 *
 * One more thing stands between a dashboard role and the dashboard, per browser
 * rather than per person: the session must be a recorded one (see `auth.ts`), so it
 * can be signed out remotely. Until then the session holds no dashboard permission
 * at all — the storefront still works, and dashboard pages send the browser to sign
 * in again (`/login/sign-in-again`).
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
  return new Set(getEnv().ADMIN_USER_IDS);
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
 * Where a session stands at the dashboard's door.
 *
 * - `ok` — through; the role's permissions apply.
 * - `signInAgain` — a token minted before sessions were recorded: it can't be
 *   revoked, so it doesn't open the dashboard. Signing in again fixes it.
 */
export type DashboardGate = "ok" | "signInAgain";

/** The role a session's user holds, and whether this browser may use it. */
export type SessionAccess = {
  /** The stored (or break-glass) role; `null` when signed out or the account is gone. */
  role: UserRole | null;
  gate: DashboardGate;
};

/**
 * The role stored on the user, memoized for the current server render: a dashboard
 * page asks from its layout, its own guard and its permission checks, and they all
 * get one database read. Outside a render (route handlers, tests) `cache` is a
 * plain call, so each API request still reads the role fresh.
 */
const storedRole = cache(async (userId: string): Promise<UserRole | null> => {
  const user = await userRepository.getById(userId);
  return user?.role ?? null;
});

/** The role policy, once per render (and cached across requests by the repository). */
const currentPolicy = cache((): Promise<RolePolicy> => roleRepository.policy());

/**
 * The role behind a session and whether this browser may use it on the dashboard.
 *
 * Break-glass ids resolve to `owner`: the allowlist exists to bootstrap the first
 * owner and to recover a lost one, so it has to be the *most* privileged answer or
 * it can't do either job. They pass through the same per-browser check as anyone.
 */
export async function sessionAccess(session: Session | null): Promise<SessionAccess> {
  const userId = session?.user?.id;
  if (!userId) return { role: null, gate: "ok" };
  const role = isBreakGlassAdmin(userId) ? "owner" : await storedRole(userId);
  if (role === null || !isDashboardRole(role)) return { role, gate: "ok" };

  if (!session?.sessionId) return { role, gate: "signInAgain" };
  return { role, gate: "ok" };
}

/**
 * The effective role of a session for the dashboard, or `null` when signed out. A
 * dashboard user whose browser hasn't passed the door's check reads as `customer`
 * until it has — signed in, but holding nothing here.
 */
export async function sessionRole(session: Session | null): Promise<UserRole | null> {
  const { role, gate } = await sessionAccess(session);
  if (role === null) return null;
  return gate === "ok" ? role : "customer";
}

/** Whether a session carries a permission. The single question every guard asks. */
export async function sessionHas(session: Session | null, permission: Permission): Promise<boolean> {
  return (await sessionPermissions(session)).includes(permission);
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

/** {@link getSessionWith} for an endpoint that serves whoever holds any one of `permissions`. */
export async function getSessionWithAny(permissions: readonly Permission[]): Promise<Session | null> {
  const session = await auth();
  const held = await sessionPermissions(session);
  return permissions.some((permission) => held.includes(permission)) ? session : null;
}

/**
 * Server-side guard for a dashboard *page*. Returns the session when it carries
 * `permission`. Anonymous visitors go to `/login` (with a `callbackUrl`); a
 * dashboard user whose browser owes a fresh sign-in goes to `/login/sign-in-again`;
 * signed-in users without the permission are sent somewhere they belong rather than
 * shown a 404 or a 401 — the dashboard's existence isn't leaked to a customer, and a
 * staff member who wandered onto the promo-codes page is bounced to the dashboard
 * root instead of into an error boundary.
 */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await auth();
  const pathname = async (): Promise<string> => (await headers()).get("x-pathname") ?? "/dashboard";

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(await pathname())}`);
  }

  const access = await sessionAccess(session);
  if (access.gate !== "ok") {
    redirect(`/login/sign-in-again?callbackUrl=${encodeURIComponent(await pathname())}`);
  }

  if (!(await sessionHas(session, permission))) {
    // A user who belongs in the dashboard but not on this page goes to the root;
    // everyone else goes to the storefront.
    redirect(access.role != null && isDashboardRole(access.role) ? "/dashboard" : "/");
  }

  return session;
}

/**
 * The permissions a session holds, for the presentation layer — and the answer
 * every guard above is built on.
 *
 * The sidebar and the detail screens need to know what to *offer* — a button that
 * can only 401 is worse than no button. This is that answer, computed once per
 * render and passed down, so a screen never re-asks per control. Every endpoint
 * still checks for itself; this only decides what gets drawn.
 */
export async function sessionPermissions(session: Session | null): Promise<readonly Permission[]> {
  const role = await sessionRole(session);
  if (role === null) return [];
  return (await currentPolicy()).permissionsOf(role);
}
