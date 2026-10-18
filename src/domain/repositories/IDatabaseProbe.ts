/**
 * Liveness probe for the primary database. A port so the health check stays
 * storage-agnostic; the container binds a Prisma `SELECT 1`.
 *
 * `ping` resolves when the database answered and rejects otherwise.
 */
export type IDatabaseProbe = {
  ping(): Promise<void>;
};
