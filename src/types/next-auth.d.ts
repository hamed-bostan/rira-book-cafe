import type { DefaultSession } from "next-auth";

/**
 * Expose the user's id on the session. Auth.js v5 doesn't surface it by default;
 * the `session` callback in `auth.ts` copies it from `token.sub` so
 * `requireAdmin()` can look the user's role up by it. The role itself is
 * deliberately *not* on the session — it's read from the database per request so
 * revoking access takes effect immediately (see `require-admin.ts`). (Module
 * augmentation must use `interface` for declaration merging.)
 */
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /**
     * The signed-in browser's session row (see `UserSession`), so a screen can mark
     * "this browser" and the dashboard's door can tell a recorded session from a
     * token minted before sessions were. Absent on such an old token.
     */
    sessionId?: string;
    /** Whether this browser passed the authenticator-app check (read from the session row). */
    twoFactorVerified?: boolean;
  }
}
