import { headers } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";

import { SESSION_MAX_AGE_MS } from "@/src/domain/entities/UserSession";
import { VerifyOtp } from "@/src/domain/use-cases/auth/VerifyOtp";
import { GetOrCreateUser } from "@/src/domain/use-cases/profile/GetOrCreateUser";
import { CheckSession, StartSession } from "@/src/domain/use-cases/sessions/SessionCommands";
import { authRepository, logger, sessionRepository, userRepository } from "@/src/infrastructure/container";

/**
 * The session row behind a token, checked once per server render (React's
 * `cache`; outside a render, e.g. in a route handler, it's a plain call — one
 * primary-key read per request). `null` means revoked, expired or gone.
 */
const checkSession = cache((sessionId: string, userId: string) =>
  new CheckSession(sessionRepository).execute(sessionId, userId),
);

/** The browser's user agent at sign-in, for the sessions list. Absent outside a request. */
async function requestUserAgent(): Promise<string | null> {
  try {
    return (await headers()).get("user-agent");
  } catch {
    return null;
  }
}

/**
 * NextAuth (Auth.js v5) configuration. Credentials provider only — its
 * `authorize` delegates to the `AuthenticateUser` use-case so the auth rule
 * lives in the domain, not in the framework glue. JWT sessions (no DB adapter).
 *
 * A JWT alone can't be taken back before it expires, so each sign-in also records
 * a session row and the token carries its id (`sid`). The `jwt` callback checks
 * that row on every read of the session: a revoked one ("sign out everywhere", a
 * member removed from the team) answers `null`, which Auth.js treats as signed out.
 *
 * A token minted before sessions were recorded has no `sid`. It still works on the
 * storefront — guests aren't signed out by this — but it can't open the dashboard,
 * which asks for a fresh sign-in (see `sessionAccess`).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: { signIn: "/login" },
  // Self-hosted behind nginx (not Vercel): Auth.js must be told to trust the
  // proxied Host/X-Forwarded-Host, or it raises an `UntrustedHost` configuration
  // error ("There was a problem with the server configuration") on auth flows.
  trustHost: true,
  // Auth.js's default lifetime, stated because the session rows expire with it.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_MS / 1000 },
  // Cookies keep Auth.js's defaults on purpose: HttpOnly + SameSite=Lax always,
  // and Secure (with the `__Secure-`/`__Host-` name prefixes) whenever the public
  // URL is HTTPS — detected from nginx's X-Forwarded-Proto. Not forced on: while
  // the site is served over plain HTTP a Secure cookie would never be sent back,
  // and sign-in would silently fail. Cross-site API writes are also refused by the
  // Origin check in `proxy.ts`.
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone number", type: "tel" },
        code: { label: "Code", type: "text" },
      },
      authorize: async (credentials) => {
        const phone = typeof credentials?.phone === "string" ? credentials.phone : "";
        const code = typeof credentials?.code === "string" ? credentials.code : "";

        const identity = await new VerifyOtp(authRepository).execute(phone, code);
        if (!identity) return null;

        // Persist the user on first sign-in (idempotent), so the profile row
        // exists before any profile read — and so the session carries the
        // user's real, completed name once they've filled it in.
        const user = await new GetOrCreateUser(userRepository).execute(identity);
        return { id: user.id, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Sign-in: record the session and carry its id from now on.
      if (user?.id) {
        const session = await new StartSession(sessionRepository).execute(user.id, await requestUserAgent());
        return { ...token, sid: session.id };
      }

      // A token from before sessions were recorded: left as it was (see above).
      if (typeof token.sid !== "string" || !token.sub) return token;

      const check = await checkSession(token.sid, token.sub);
      if (!check) return null;
      return token;
    },
    // The user id rides on the standard `sub` claim (Auth.js sets it from
    // `user.id` on sign-in). Surface it on the session so guards (e.g.
    // requireAdmin) can read it — Auth.js v5 doesn't expose it by default. The
    // session id rides along for the dashboard's door.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (typeof token.sid === "string") session.sessionId = token.sid;
      return session;
    },
  },
  events: {
    // Signing out ends the session row too, so the token is dead even if a copy of
    // the cookie survives somewhere.
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (typeof token?.sid !== "string" || !token.sub) return;
      try {
        await sessionRepository.revoke(token.sub, token.sid);
      } catch (error) {
        logger.error("Couldn't end the session row on sign-out", { error });
      }
    },
  },
});
