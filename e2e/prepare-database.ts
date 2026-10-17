/**
 * `tsx e2e/prepare-database.ts`: a freshly migrated and seeded E2E database (the
 * sample menu plus `TEST_USERS`).
 *
 * Run by Playwright's webServer command *before* the server starts, not from the
 * global setup: Playwright starts the webServer first and waits for it to answer,
 * and the pages it polls already read the database.
 */
import { ensureTestDatabase, migrateTestDatabase } from "../tests/fixtures/migrate-test-database";

import { E2E_DATABASE_URL } from "./fixtures/env";

async function main(): Promise<void> {
  await ensureTestDatabase(E2E_DATABASE_URL);
  await migrateTestDatabase(E2E_DATABASE_URL);

  // The Prisma client reads DATABASE_URL when it's first imported, so point it at
  // the E2E database before loading anything that touches it.
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  const { seedTestDatabase } = await import("../tests/fixtures/database");
  const { prisma } = await import("../src/infrastructure/prisma/client");
  try {
    await seedTestDatabase();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
