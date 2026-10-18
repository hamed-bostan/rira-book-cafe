import { singleChange, type ActivityActor, type NewActivityEntry } from "../../entities/ActivityEntry";
import {
  bankFeeEntry,
  bankInterestEntry,
  reconciliationSummary,
  suggestMatches,
  type BankLinePosting,
  type BankStatement,
  type BankStatementSummary,
  type LedgerCandidate,
  type MatchPair,
  type NewStatementLine,
  type ReconciliationSummary,
} from "../../entities/BankReconciliation";
import { cafeDayOf } from "../../entities/CafeTime";
import { SYSTEM_ACCOUNTS, type JournalEntry } from "../../entities/Ledger";
import { gatewaySettlementEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type {
  IBankReconciliationRepository,
  MatchGroup,
  StatementChange,
} from "../../repositories/IBankReconciliationRepository";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";

/** A statement with everything the reconciliation screen shows. */
export type BankReconciliationView = {
  statement: BankStatement;
  candidates: LedgerCandidate[];
  summary: ReconciliationSummary;
  /** Safe one-to-one matches the screen can offer to make in one click. */
  suggestions: MatchPair[];
};

export type StatementInput = {
  fromDay: string;
  toDay: string;
  openingBalance: number;
  closingBalance: number;
  lines: NewStatementLine[];
};

const statementLabel = (statement: Pick<BankStatement, "fromDay" | "toDay">) =>
  `Bank statement ${statement.fromDay} – ${statement.toDay}`;

const statementAudit =
  (actor: ActivityActor, action: NewActivityEntry["action"], field: string) =>
  ({ statement, count }: StatementChange): NewActivityEntry => ({
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "ledger",
    entityId: statement.id,
    entityLabel: statementLabel(statement),
    changes: singleChange(field, null, count),
  });

/** Statement lines must be real movements on days inside the statement's period. */
function assertLines(lines: readonly NewStatementLine[], period: { fromDay: string; toDay: string }): void {
  for (const line of lines) {
    if (!Number.isSafeInteger(line.amount) || line.amount === 0) throw new ValidationError("lines", "amountInvalid");
    if (line.date < period.fromDay || line.date > period.toDay) throw new ValidationError("lines", "lineOutsidePeriod");
  }
}

async function requireStatement(repository: IBankReconciliationRepository, id: string): Promise<BankStatement> {
  const statement = await repository.getStatement(id);
  if (!statement) throw new NotFoundError("bank statement", id);
  return statement;
}

export class ListBankStatements {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  execute(): Promise<BankStatementSummary[]> {
    return this.bank.listStatements();
  }
}

/** One statement with its candidates, the reconciliation proof and match suggestions; `null` when it doesn't exist. */
export class GetBankReconciliation {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  async execute(id: string): Promise<BankReconciliationView | null> {
    const statement = await this.bank.getStatement(id);
    if (!statement) return null;
    const [candidates, book] = await Promise.all([this.bank.candidates(id), this.bank.bookFigures(id)]);
    return {
      statement,
      candidates,
      summary: reconciliationSummary(statement, book),
      suggestions: statement.status === "open" ? suggestMatches(statement.lines, candidates) : [],
    };
  }
}

/**
 * Enter a bank statement for a period: its opening and closing balance and its
 * lines (typed or imported). It must continue the previous statement — starting
 * after it and opening at its closing balance.
 */
export class CreateBankStatement {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  async execute(input: StatementInput, actor: ActivityActor, now: Date = new Date()): Promise<BankStatement> {
    if (input.toDay > cafeDayOf(now)) throw new ValidationError("toDay", "That date is in the future.");
    if (input.fromDay > input.toDay) throw new ValidationError("toDay", "periodEndsBeforeStart");
    assertLines(input.lines, input);
    return this.bank.createStatement({ ...input, createdById: actor.id, createdByName: actor.name }, (statement) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "ledger.bankStatementChanged",
      entityType: "ledger",
      entityId: statement.id,
      entityLabel: statementLabel(statement),
      changes: singleChange("closingBalance", null, statement.closingBalance),
    }));
  }
}

export class AddStatementLines {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  async execute(statementId: string, lines: NewStatementLine[], actor: ActivityActor): Promise<BankStatement> {
    const statement = await requireStatement(this.bank, statementId);
    assertLines(lines, statement);
    return this.bank.addLines(statementId, lines, statementAudit(actor, "ledger.bankStatementChanged", "linesAdded"));
  }
}

export class RemoveStatementLine {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  execute(statementId: string, lineId: string, actor: ActivityActor): Promise<BankStatement> {
    return this.bank.removeLine(
      statementId,
      lineId,
      statementAudit(actor, "ledger.bankStatementChanged", "linesRemoved"),
    );
  }
}

/** Match statement lines to ledger lines whose totals agree. */
export class MatchBankLines {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  execute(statementId: string, group: MatchGroup, actor: ActivityActor): Promise<number> {
    return this.bank.match(statementId, [group], actor, statementAudit(actor, "ledger.bankMatched", "matched"));
  }
}

/** Make every safe one-to-one match (same amount, close dates, no rival) at once; returns how many. */
export class AutoMatchBankLines {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  async execute(statementId: string, actor: ActivityActor): Promise<number> {
    const statement = await requireStatement(this.bank, statementId);
    if (statement.status !== "open")
      throw new ConflictError("STATEMENT_RECONCILED", "This statement is already reconciled.");
    const pairs = suggestMatches(statement.lines, await this.bank.candidates(statementId));
    if (pairs.length === 0) return 0;
    return this.bank.match(
      statementId,
      pairs.map((pair) => ({ statementLineIds: [pair.statementLineId], ledgerLineIds: [pair.ledgerLineId] })),
      actor,
      statementAudit(actor, "ledger.bankMatched", "matched"),
    );
  }
}

export class UnmatchBankLines {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  execute(statementId: string, matchId: string, actor: ActivityActor): Promise<void> {
    return this.bank.unmatch(statementId, matchId, statementAudit(actor, "ledger.bankUnmatched", "unmatched"));
  }
}

export type RecordLineInput = {
  kind: BankLinePosting;
  /** Gateway payouts only: the fee the gateway kept. */ fee: number;
};

/**
 * Book what a statement line shows the bank did on its own, and match it:
 *  - a fee (money out): Dr Bank and gateway fees / Cr Bank;
 *  - interest (money in): Dr Bank / Cr Bank interest income;
 *  - a gateway payout (money in): Dr Bank (+ Dr fees) / Cr Gateway clearing —
 *    refused above what the gateway holds for the cafe on that day.
 */
export class RecordStatementLine {
  constructor(
    private readonly bank: IBankReconciliationRepository,
    private readonly ledger: ILedgerRepository,
  ) {}

  async execute(
    statementId: string,
    lineId: string,
    input: RecordLineInput,
    actor: ActivityActor,
  ): Promise<JournalEntry> {
    const statement = await requireStatement(this.bank, statementId);
    const line = statement.lines.find((candidate) => candidate.id === lineId);
    if (!line) throw new NotFoundError("statement line", lineId);
    if (input.kind === "fee" ? line.amount >= 0 : line.amount <= 0) throw new ValidationError("kind", "wrongDirection");
    if (!Number.isSafeInteger(input.fee) || input.fee < 0 || (input.kind !== "gatewayPayout" && input.fee !== 0)) {
      throw new ValidationError("fee", "amountInvalid");
    }

    if (input.kind === "gatewayPayout") {
      const clearing = (await this.ledger.movements(undefined, line.date)).find(
        (movement) => movement.accountCode === SYSTEM_ACCOUNTS.gatewayClearing,
      );
      const held = clearing ? clearing.debit - clearing.credit : 0;
      if (line.amount + input.fee > held) throw new ValidationError("fee", "exceedsGatewayBalance");
    }

    return this.bank.postAndMatch(
      statementId,
      lineId,
      (current) => {
        switch (input.kind) {
          case "fee":
            return bankFeeEntry(current, actor);
          case "interest":
            return bankInterestEntry(current, actor);
          case "gatewayPayout":
            return gatewaySettlementEntry(
              {
                date: current.date,
                deposited: current.amount,
                fee: input.fee,
                reference: current.reference ?? current.description,
              },
              actor,
            );
        }
      },
      (posted) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "ledger.entryPosted",
        entityType: "ledger",
        entityId: posted.id,
        entityLabel: `JE-${posted.number}`,
        changes: singleChange(
          "amount",
          null,
          posted.lines.reduce((sum, row) => sum + row.debit, 0),
        ),
      }),
    );
  }
}

/**
 * Sign the statement off: every line matched, the lines adding up to the closing
 * balance, and the adjusted book balance equal to it — checked against figures read
 * in the same transaction. After this its lines and matches can't change.
 */
export class ReconcileBankStatement {
  constructor(private readonly bank: IBankReconciliationRepository) {}

  execute(statementId: string, actor: ActivityActor): Promise<BankStatement> {
    return this.bank.reconcile(
      statementId,
      actor,
      (statement, book) => {
        if (statement.status !== "open")
          throw new ConflictError("STATEMENT_RECONCILED", "This statement is already reconciled.");
        const summary = reconciliationSummary(statement, book);
        if (!summary.canReconcile) {
          throw new ConflictError(
            "NOT_RECONCILED",
            `Not reconciled: ${summary.unmatchedLines} unmatched line(s), statement gap ${summary.statementGap}, difference ${summary.difference}.`,
          );
        }
      },
      (statement) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "ledger.bankReconciled",
        entityType: "ledger",
        entityId: statement.id,
        entityLabel: statementLabel(statement),
        changes: singleChange("status", "open", "reconciled"),
      }),
    );
  }
}
