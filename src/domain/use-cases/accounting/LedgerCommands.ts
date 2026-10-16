import { diffFields, singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { MAX_VAT_RATE_BPS, reversalOf, typeForCode, type Account, type AccountingSettings, type JournalEntry } from "../../entities/Ledger";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ILedgerRepository, NewAccount } from "../../repositories/ILedgerRepository";

/** One line of a manual entry as entered: an account and one side's amount. */
export type ManualEntryLine = { accountCode: string; debit: number; credit: number; memo?: string };
export type ManualEntryInput = { date: string; description: string; lines: ManualEntryLine[] };

const entryLabel = (entry: Pick<JournalEntry, "number">) => `JE-${entry.number}`;
const entryTotal = (entry: Pick<JournalEntry, "lines">) => entry.lines.reduce((sum, line) => sum + line.debit, 0);

/** Refuse a date after today: the books record what happened, not what will. */
function assertNotFuture(field: string, day: string, now: Date): void {
  if (day > cafeDayOf(now)) throw new ValidationError(field, "That date is in the future.");
}

/**
 * Post a manual journal entry — owner's capital, a VAT payment to the tax office,
 * depreciation, an opening balance. The repository refuses an unbalanced entry, a
 * closed period or an inactive account; this adds the date rule and the audit.
 */
export class PostManualEntry {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(input: ManualEntryInput, actor: ActivityActor, now: Date = new Date()): Promise<JournalEntry> {
    assertNotFuture("date", input.date, now);
    return this.ledger.post(
      {
        date: input.date,
        description: input.description.trim(),
        source: "manual",
        lines: input.lines.map((line) => ({ ...line, memo: line.memo?.trim() || undefined })),
        createdById: actor.id,
        createdByName: actor.name,
      },
      (posted) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "ledger.entryPosted",
        entityType: "ledger",
        entityId: posted.id,
        entityLabel: entryLabel(posted),
        changes: singleChange("amount", null, entryTotal(posted)),
      }),
    );
  }
}

/**
 * Reverse a manual entry. Entries an order or expense posted are corrected from
 * that order or expense (cancel, unmark, void) so the document and the books can't
 * disagree; reversing them here is refused.
 */
export class ReverseJournalEntry {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(entryId: string, date: string, reason: string, actor: ActivityActor, now: Date = new Date()): Promise<JournalEntry> {
    const entry = await this.ledger.getEntry(entryId);
    if (!entry) throw new NotFoundError("journal entry", entryId);
    if (entry.source !== "manual") {
      throw new ConflictError("NOT_REVERSIBLE", "This entry was posted by an order or an expense — correct it there.");
    }
    assertNotFuture("date", date, now);
    if (date < entry.date) throw new ValidationError("date", "A reversal can't be dated before the entry it reverses.");

    return this.ledger.reverse(
      entryId,
      (original) => reversalOf(original, date, reason, actor),
      (reversal) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "ledger.entryReversed",
        entityType: "ledger",
        entityId: entry.id,
        entityLabel: entryLabel(entry),
        changes: singleChange("reversedBy", null, entryLabel(reversal)),
      }),
    );
  }
}

const accountAudit =
  (actor: ActivityActor, changes: (account: Account) => ReturnType<typeof singleChange>) =>
  (account: Account) => ({
    actorId: actor.id,
    actorName: actor.name,
    action: "ledger.accountChanged" as const,
    entityType: "ledger" as const,
    entityId: account.code,
    entityLabel: `${account.code} ${account.name}`,
    changes: changes(account),
  });

/**
 * Add an account to the chart. The code's first digit must match its type
 * (1 assets, 2 liabilities, 3 equity, 4 revenue, 5–9 expenses), which is what
 * keeps the statements' sections right.
 */
export class CreateLedgerAccount {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(input: NewAccount, actor: ActivityActor): Promise<Account> {
    if (!/^\d{4}$/.test(input.code)) throw new ValidationError("code", "Account codes are four digits.");
    if (typeForCode(input.code) !== input.type) {
      throw new ValidationError("type", `A ${input.code[0]}xxx code is a ${typeForCode(input.code)} account.`);
    }
    return this.ledger.createAccount(
      { ...input, name: input.name.trim(), nameFa: input.nameFa.trim() },
      accountAudit(actor, (account) => singleChange("name", null, account.name)),
    );
  }
}

export class SetLedgerAccountActive {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(code: string, isActive: boolean, actor: ActivityActor): Promise<Account> {
    return this.ledger.setAccountActive(
      code,
      isActive,
      accountAudit(actor, (account) => singleChange("isActive", !account.isActive, account.isActive)),
    );
  }
}

/**
 * Change the VAT rate or move the period lock. Closing through a day freezes every
 * entry dated on or before it; a close can't be set in the future, and every move
 * (including reopening) is audited.
 */
export class UpdateAccountingSettings {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(settings: AccountingSettings, actor: ActivityActor, now: Date = new Date()): Promise<AccountingSettings> {
    if (!Number.isInteger(settings.vatRateBps) || settings.vatRateBps < 0 || settings.vatRateBps > MAX_VAT_RATE_BPS) {
      throw new ValidationError("vatRate", "Enter a VAT rate from 0 to 50%.");
    }
    if (settings.booksClosedThrough) assertNotFuture("booksClosedThrough", settings.booksClosedThrough, now);

    const before = await this.ledger.getSettings();
    return this.ledger.updateSettings(settings, (saved) => {
      const changes = diffFields(
        { vatRateBps: before.vatRateBps, booksClosedThrough: before.booksClosedThrough },
        { vatRateBps: saved.vatRateBps, booksClosedThrough: saved.booksClosedThrough },
      );
      return changes.length === 0
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "ledger.settingsChanged",
            entityType: "ledger",
            entityId: "settings",
            entityLabel: "Accounting settings",
            changes,
          };
    });
  }
}
