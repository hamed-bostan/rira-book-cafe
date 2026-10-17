import { migrateTestDatabase } from "../fixtures/migrate-test-database";
import { TEST_DATABASE_URL } from "../fixtures/test-env";

/** Once per `npm run test:integration`: a freshly migrated, empty test database. */
export default async function globalSetup(): Promise<void> {
  await migrateTestDatabase(TEST_DATABASE_URL);
}
