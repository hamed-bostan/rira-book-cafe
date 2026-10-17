import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { TEST_USERS, type TestUserKey } from "../tests/fixtures/users";

import { E2E_BASE_URL } from "./fixtures/env";
import { signedInState, storageStatePath } from "./fixtures/sessions";

/**
 * Once per `npm run test:e2e`, after the server is up: a signed-in browser state per
 * test user. (The database is prepared before the server starts — see
 * `prepare-database.ts`.)
 */
export default async function globalSetup(): Promise<void> {
  const host = new URL(E2E_BASE_URL).hostname;
  for (const user of Object.keys(TEST_USERS) as TestUserKey[]) {
    const path = storageStatePath(user);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(await signedInState(user, host), null, 2));
  }
}
