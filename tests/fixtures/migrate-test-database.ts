import { execSync } from "node:child_process";

import { createPrismaClient } from "@/src/infrastructure/prisma/createPrismaClient";

import { assertTestDatabase } from "./test-env";

/**
 * Create the test database if the server doesn't have it yet (the E2E database
 * sits next to the integration one in the same container). Connects to the
 * server's `postgres` maintenance database to do it.
 */
export async function ensureTestDatabase(databaseUrl: string): Promise<void> {
  assertTestDatabase(databaseUrl);
  const url = new URL(databaseUrl);
  const name = url.pathname.replace(/^\//, "");
  url.pathname = "/postgres";

  const client = createPrismaClient(url.toString());
  try {
    const rows = await client.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${name}) AS "exists"`;
    if (!rows[0]?.exists) await client.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
  } finally {
    await client.$disconnect();
  }
}

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

  const client = createPrismaClient(databaseUrl);
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
