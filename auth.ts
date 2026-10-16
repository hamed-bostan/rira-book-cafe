import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { VerifyOtp } from "@/src/domain/use-cases/auth/VerifyOtp";
import { GetOrCreateUser } from "@/src/domain/use-cases/profile/GetOrCreateUser";
import { authRepository, userRepository } from "@/src/infrastructure/container";

/**
 * NextAuth (Auth.js v5) configuration. Credentials provider only — its
 * `authorize` delegates to the `AuthenticateUser` use-case so the auth rule
 * lives in the domain, not in the framework glue. JWT sessions (no DB adapter).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: { signIn: "/login" },
  // Self-hosted behind nginx (not Vercel): Auth.js must be told to trust the
  // proxied Host/X-Forwarded-Host, or it raises an `UntrustedHost` configuration
  // error ("There was a problem with the server configuration") on auth flows.
  trustHost: true,
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
    // The user id rides on the standard `sub` claim (Auth.js sets it from
    // `user.id` on sign-in). Surface it on the session so guards (e.g.
    // requireAdmin) can read it — Auth.js v5 doesn't expose it by default.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
