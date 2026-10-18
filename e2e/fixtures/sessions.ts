import { join } from "node:path";

import { encode } from "next-auth/jwt";

import { TEST_USERS, type TestUserKey } from "../../tests/fixtures/users";

import { E2E_AUTH_SECRET } from "./env";

/** Auth.js's session cookie over plain http (no `__Secure-` prefix). */
const SESSION_COOKIE = "authjs.session-token";
const SESSION_SECONDS = 24 * 60 * 60;

/** Where each role's signed-in browser state is written (gitignored). */
export function storageStatePath(user: TestUserKey): string {
  return join(__dirname, "..", ".auth", `${user}.json`);
}

type StorageState = {
  cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Lax";
  }[];
  origins: never[];
};

/**
 * A signed-in browser for `user`, without going through the OTP screens: the same
 * JWT Auth.js would set after a sign-in, signed with the server's test secret.
 * The sign-in flow itself has its own spec (`auth.spec.ts`); every other spec
 * starts already signed in, so it doesn't depend on (or get rate-limited by) it.
 */
export async function signedInState(user: TestUserKey, host: string): Promise<StorageState> {
  const { id, name } = TEST_USERS[user];
  const value = await encode({
    token: { sub: id, name },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: SESSION_SECONDS,
  });
  return {
    cookies: [
      {
        name: SESSION_COOKIE,
        value,
        domain: host,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  };
}
