import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Either the root Prisma client or a transaction-scoped one.
 *
 * Repositories hold this rather than the `prisma` singleton so the same class can
 * serve a normal call (root client, opens its own transaction when it needs one)
 * and a call inside a unit of work (transaction client, joins the caller's).
 */
export type PrismaDb = PrismaClient | Prisma.TransactionClient;

/**
 * Whether this client can open a transaction — i.e. is the root client rather than
 * one already scoped to a transaction.
 *
 * Prisma's `TransactionClient` is the client minus the connection-level methods,
 * `$transaction` among them, so the property's presence *is* the signal rather
 * than a heuristic. It has to be checked because Prisma has no nested
 * transactions: `$transaction` on a transaction client isn't a savepoint, it's a
 * second connection that will deadlock against the first.
 *
 * Written as a boolean with casts at the call site rather than a
 * `db is PrismaClient` type predicate, because a predicate would be a lie in the
 * type system's terms: `PrismaClient` has every member `TransactionClient` has, so
 * TypeScript sees the union as collapsing and narrows the other branch to `never`.
 * The distinction is real at runtime and invisible to structural typing.
 */
function canOpenTransaction(db: PrismaDb): boolean {
  return "$transaction" in db;
}

/**
 * Run `work` in a transaction, joining the caller's if one is already open.
 *
 * This is what lets a repository method keep its own atomicity guarantee while
 * also composing into a larger one. `adjustStock` must be atomic whether it's
 * called on its own from the stock endpoint or as one step of a return being
 * refunded; written as a bare `prisma.$transaction` it could only be the first.
 *
 * The nesting is flattened rather than emulated: joining means the outer
 * transaction's commit is the only commit, so a later step failing rolls back the
 * earlier ones. That is precisely the property the callers want — a refund that
 * puts stock back and credits a wallet should not be able to do one and not the
 * other — and it's why `work` receives a client it must use for every statement.
 * A statement issued against the singleton from inside here runs on a different
 * connection, outside the transaction, and will not roll back with it.
 */
export function inTransaction<T>(
  db: PrismaDb,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  if (canOpenTransaction(db)) return (db as PrismaClient).$transaction(work, options);
  // Already inside someone else's transaction: the options describe *opening* one,
  // and there is nothing to open. Silently ignored rather than thrown on, because
  // joining is the documented behaviour above and a caller asking for a longer
  // timeout shouldn't fail just because it was composed into a larger operation.
  return work(db);
}

/**
 * How to open a transaction, for the callers whose needs differ from Prisma's
 * defaults (2s to acquire a connection, 5s to run, READ COMMITTED).
 */
export type TransactionOptions = {
  /** How long to wait for a pool connection before giving up. Prisma's default is 2s. */
  maxWait?: number;
  /** How long the transaction may run before it is rolled back. Prisma's default is 5s. */
  timeout?: number;
  /**
   * Postgres defaults to READ COMMITTED, under which *every statement* takes its
   * own snapshot — so a multi-statement read transaction can see the table change
   * underneath it. `RepeatableRead` is what actually makes "these numbers all
   * describe one moment" true, and for read-only work it costs nothing (only
   * writes can hit serialization failures).
   */
  isolationLevel?: Prisma.TransactionIsolationLevel;
};
