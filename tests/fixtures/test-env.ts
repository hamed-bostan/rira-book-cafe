/**
 * Where the integration and E2E tests find their database.
 *
 * Defaults to the throwaway container in `docker-compose.test.yml`
 * (`npm run db:test:up`); CI points `TEST_DATABASE_URL` at its Postgres service.
 * Never the dev database: the runs drop and recreate every table.
 */
export const TEST_DATABASE_URL: string =
  process.env.TEST_DATABASE_URL ?? "postgresql://rira:testpassword@localhost:5546/rira_test";

/**
 * Refuse to touch a database whose name doesn't say it's for tests. The test runs
 * wipe it, so pointing `TEST_DATABASE_URL` at the dev (or a real) database by
 * mistake must fail loudly instead of deleting someone's data.
 */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to reset database "${name}": its name must contain "test" (see tests/fixtures/test-env.ts).`);
  }
}
