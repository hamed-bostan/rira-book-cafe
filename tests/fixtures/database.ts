import { seedSampleData } from "@/scripts/seed-sample-data";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "./users";

/**
 * The test database's starting state: the migrations' own rows (chart of accounts,
 * settings), the dev seed's sample menu and events, and one account per role
 * (`TEST_USERS`). Expects a freshly migrated database (`migrateTestDatabase`).
 */
export async function seedTestDatabase(): Promise<void> {
  await seedSampleData();
  for (const user of Object.values(TEST_USERS)) {
    await prisma.user.create({ data: user });
  }
}

/**
 * Restoring that state between tests by re-running the seed costs seconds per test
 * (hundreds of sequential upserts). Instead the first call seeds once and copies
 * every table into a `snapshot` schema; each later call truncates the live tables
 * and copies the snapshot back — tens of milliseconds.
 *
 * The copy runs with `session_replication_role = replica`, which suspends triggers
 * and foreign-key checks for that transaction only: the journal, stock movements
 * and loyalty ledger are append-only by trigger, and those guards would otherwise
 * refuse the very rows a reset must put back. Serial counters (order numbers,
 * journal numbers, …) are then set past the restored rows.
 */
export async function restoreTestDatabase(): Promise<void> {
  const [{ exists }] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'snapshot') AS "exists"`;

  if (!exists) {
    await seedTestDatabase();
    await prisma.$executeRawUnsafe(TAKE_SNAPSHOT);
    return;
  }
  await prisma.$executeRawUnsafe(RESTORE_SNAPSHOT);
}

const TAKE_SNAPSHOT = `
DO $$
DECLARE t text;
BEGIN
  CREATE SCHEMA "snapshot";
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('CREATE TABLE "snapshot".%I AS TABLE "public".%I', t, t);
  END LOOP;
END $$`;

const RESTORE_SNAPSHOT = `
DO $$
DECLARE
  t text;
  r record;
BEGIN
  SET LOCAL session_replication_role = replica;
  EXECUTE (
    SELECT 'TRUNCATE ' || string_agg(format('"public".%I', tablename), ', ') || ' CASCADE'
    FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  );
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'snapshot' LOOP
    EXECUTE format('INSERT INTO "public".%I SELECT * FROM "snapshot".%I', t, t);
  END LOOP;
  FOR r IN
    SELECT seq.relname AS seq, tbl.relname AS tbl, col.attname AS col
    FROM pg_class seq
    JOIN pg_namespace ns ON ns.oid = seq.relnamespace AND ns.nspname = 'public'
    JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype = 'a'
    JOIN pg_class tbl ON tbl.oid = dep.refobjid
    JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = dep.refobjsubid
    WHERE seq.relkind = 'S'
  LOOP
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT max(%I) FROM "public".%I), 0) + 1, false)',
      '"public".' || quote_ident(r.seq), r.col, r.tbl
    );
  END LOOP;
END $$`;
