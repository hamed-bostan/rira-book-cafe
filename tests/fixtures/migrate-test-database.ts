import { execSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

import { assertTestDatabase } from "./test-env";

/**
 * Drop everything in the test database and apply every migration from scratch, so
 * a run never inherits a schema (or rows) from the last one.
 *
 * Applies them with `migrate deploy` — what production runs — rather than
 * `db push`: the migrations carry triggers and starting rows the schema file alone
 * doesn't. The schema is dropped by hand rather than with `migrate reset`, which is
 * interactive and would also try to run the seed.
 */
export async function migrateTestDatabase(databaseUrl: string): Promise<void> {
  assertTestDatabase(databaseUrl);

  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    // The integration tests' reset snapshot (see `database.ts`) goes with it.
    await client.$executeRawUnsafe('DROP SCHEMA IF EXISTS "snapshot" CASCADE');
    await client.$executeRawUnsafe('DROP SCHEMA IF EXISTS "public" CASCADE');
    await client.$executeRawUnsafe('CREATE SCHEMA "public"');
  } finally {
    await client.$disconnect();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
