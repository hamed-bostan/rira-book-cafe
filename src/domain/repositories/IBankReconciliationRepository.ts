import type { AuditHook } from "./AuditHook";
import type {
  BankStatement,
  BankStatementLine,
  BankStatementSummary,
  BookFigures,
  LedgerCandidate,
  NewBankStatement,
  NewStatementLine,
} from "../entities/BankReconciliation";
import type { JournalEntry, NewJournalEntry } from "../entities/Ledger";

/** Statement lines and ledger lines that are the same money. */
export type MatchGroup = { statementLineIds: string[]; ledgerLineIds: string[] };

/** What a statement change did, for its audit entry. */
export type StatementChange = { statement: BankStatement; count: number };

export type IBankReconciliationRepository = {
  /** Statements, newest period first. */
  listStatements(): Promise<BankStatementSummary[]>;
  getStatement(id: string): Promise<BankStatement | null>;

  /**
   * Store a statement and its lines. Serialized with other creates: the period
   * must start after the latest statement ends (`ConflictError("STATEMENT_OVERLAP")`)
   * and its opening balance must be that statement's closing balance (`ValidationError`
   * on `openingBalance`).
   */
  createStatement(input: NewBankStatement, audit?: AuditHook<BankStatement>): Promise<BankStatement>;
  /** Add lines to an open statement (`STATEMENT_RECONCILED` otherwise). */
  addLines(statementId: string, lines: NewStatementLine[], audit?: AuditHook<StatementChange>): Promise<BankStatement>;
  /** Remove an unmatched line from an open statement (`ALREADY_MATCHED` when matched). */
  removeLine(statementId: string, lineId: string, audit?: AuditHook<StatementChange>): Promise<BankStatement>;

  /**
   * Ledger lines on the statement's account that it can match: unmatched lines from
   * the first statement's start to a month after this one's end, plus the lines
   * already matched on this statement.
   */
  candidates(statementId: string): Promise<LedgerCandidate[]>;
  /** The ledger side of the reconciliation proof for this statement. */
  bookFigures(statementId: string): Promise<BookFigures>;

  /**
   * Match groups of lines on an open statement, in one transaction. Every statement
   * line must belong to it and be unmatched, every ledger line must be on its
   * account, unmatched and within the candidate range, and each group must total
   * the same on both sides (`ConflictError("ALREADY_MATCHED" | "MATCH_UNBALANCED")`).
   */
  match(statementId: string, groups: MatchGroup[], actor: { id: string; name: string }, audit?: AuditHook<StatementChange>): Promise<number>;
  unmatch(statementId: string, matchId: string, audit?: AuditHook<StatementChange>): Promise<void>;
  /**
   * Post the entry a statement line records (a fee, interest, a gateway payout) and
   * match the line to the entry's line on the statement's account — one transaction.
   */
  postAndMatch(
    statementId: string,
    lineId: string,
    build: (line: BankStatementLine) => NewJournalEntry,
    audit?: AuditHook<JournalEntry>,
  ): Promise<JournalEntry>;

  /**
   * Mark the statement reconciled, with the statement row locked: earlier
   * statements must be reconciled first (`PREVIOUS_NOT_RECONCILED`), then `check`
   * sees the statement and the book figures read in the same transaction and throws
   * to refuse.
   */
  reconcile(
    statementId: string,
    actor: { id: string; name: string },
    check: (statement: BankStatement, book: BookFigures) => void,
    audit?: AuditHook<BankStatement>,
  ): Promise<BankStatement>;
};
