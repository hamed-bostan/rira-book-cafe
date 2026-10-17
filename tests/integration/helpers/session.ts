import { TEST_USERS, type TestUserKey } from "../../fixtures/users";

import type { Session } from "next-auth";

/**
 * The session the mocked `auth()` (see `setup.ts`) answers with. Only the identity
 * is faked: what a session may *do* is still decided by the real guards, which read
 * the user's role from the test database — so a test signed in as `staff` gets
 * exactly a staff member's permissions.
 */
let current: Session | null = null;

export function signInAs(user: TestUserKey | null): void {
  if (user === null) {
    current = null;
    return;
  }
  const { id, name } = TEST_USERS[user];
  current = { user: { id, name }, expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
}

export function currentSession(): Session | null {
  return current;
}
