import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import type { Session } from "next-auth";

/**
 * Server-side guard for account routes. Returns the session when signed in;
 * otherwise redirects to `/login` with a `callbackUrl` so the user lands back
 * where they were. The path comes from the `x-pathname` header set in middleware.
 */
export async function requireAuth() {
  const session = await auth();
  if (session) return session;

  const pathname = (await headers()).get("x-pathname") ?? "/";
  redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
}

/**
 * Non-redirecting auth guard for route handlers, which must answer with a JSON
 * status code rather than an HTML redirect (a `fetch` caller can't follow a login
 * redirect). Returns the session for a signed-in user, or `null` otherwise — the
 * caller decides the status (typically 401). Mirrors `getAdminSession`.
 */
export async function getUserSession(): Promise<Session | null> {
  return auth();
}
