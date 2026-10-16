"use client";

import { Link2, Unlink, Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { RecordStatementLineInput } from "@/src/contracts/bank-schema";
import type { BankStatement, LedgerCandidate, MatchPair } from "@/src/domain/entities/BankReconciliation";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Button, Checkbox, FormMessage, Icon } from "@/src/presentation/design-system";

import { bankStatementsApi } from "./bank-statement-api";
import { StatementLineActions } from "./StatementLineActions";

type BankMatchWorkspaceProps = {
  statement: BankStatement;
  candidates: LedgerCandidate[];
  suggestions: MatchPair[];
  canWrite: boolean;
};

const sum = (amounts: readonly number[]): number => amounts.reduce((total, amount) => total + amount, 0);

/**
 * Matching, side by side: the statement's unmatched lines and the Bank account's
 * unmatched ledger lines. Tick lines on both sides whose totals agree and match
 * them; let the safe one-to-one suggestions match themselves; book what only the
 * bank knows about straight from its line. Matches made so far are listed below,
 * each undoable while the statement is open.
 */
export function BankMatchWorkspace({ statement, candidates, suggestions, canWrite }: BankMatchWorkspaceProps) {
  const t = useTranslations("dashBank");
  const tAccounting = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const [bankPicked, setBankPicked] = React.useState<ReadonlySet<string>>(new Set());
  const [bookPicked, setBookPicked] = React.useState<ReadonlySet<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const editable = canWrite && statement.status === "open";
  const openLines = statement.lines.filter((line) => !line.matchId);
  const openCandidates = candidates.filter((candidate) => !candidate.matchId);
  const bankTotal = sum(openLines.filter((line) => bankPicked.has(line.id)).map((line) => line.amount));
  const bookTotal = sum(openCandidates.filter((candidate) => bookPicked.has(candidate.lineId)).map((candidate) => candidate.amount));
  const canMatch = editable && bankPicked.size > 0 && bookPicked.size > 0 && bankTotal === bookTotal;

  const matchIds = [...new Set(statement.lines.flatMap((line) => (line.matchId ? [line.matchId] : [])))];
  const matches = matchIds.map((matchId) => ({
    matchId,
    lines: statement.lines.filter((line) => line.matchId === matchId),
    ledger: candidates.filter((candidate) => candidate.matchId === matchId),
  }));

  function run(action: () => Promise<string | null>, fallback: string): void {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const message = await action();
        setBankPicked(new Set());
        setBookPicked(new Set());
        if (message) setNotice(message);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, fallback));
      }
    });
  }

  const toggle = (set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const record = (lineId: string, values: RecordStatementLineInput): void =>
    run(async () => {
      const entry = await bankStatementsApi.recordLine(statement.id, lineId, values);
      return t("workspace.recorded", { number: entry.number });
    }, t("workspace.recordError"));

  const amountClass = (amount: number): string => (amount < 0 ? "text-error-foreground" : "text-success-foreground");

  return (
    <div className="flex flex-col gap-4">
      {editable ? (
        <div className="flex flex-wrap items-center gap-3">
          {suggestions.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(async () => t("workspace.autoMatched", { count: await bankStatementsApi.autoMatch(statement.id) }), t("workspace.matchError"))}
            >
              <Icon icon={Wand2} size="sm" className="me-1.5" />
              {t("workspace.autoMatch", { count: suggestions.length })}
            </Button>
          ) : null}
          <span className="text-body-small text-muted-foreground">
            {t("workspace.selection", { bank: formatMoney(bankTotal, locale), books: formatMoney(bookTotal, locale) })}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!canMatch || pending}
            className="ms-auto"
            onClick={() =>
              run(async () => {
                await bankStatementsApi.match(statement.id, { statementLineIds: [...bankPicked], ledgerLineIds: [...bookPicked] });
                return null;
              }, t("workspace.matchError"))
            }
          >
            <Icon icon={Link2} size="sm" className="me-1.5" />
            {t("workspace.match")}
          </Button>
        </div>
      ) : null}
      {error ? <FormMessage size="md">{error}</FormMessage> : null}
      {notice ? (
        <p className="text-body-small text-success-foreground" aria-live="polite">
          {notice}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="flex min-w-0 flex-col rounded-card-lg border border-border bg-background">
          <h2 className="border-b border-border px-4 py-3 text-body-strong text-foreground">{t("workspace.bankSide", { count: openLines.length })}</h2>
          {openLines.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-small text-muted-foreground">{t("workspace.bankDone")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {openLines.map((line) => (
                <li key={line.id} className="flex items-center gap-3 px-4 py-2.5 text-body-small">
                  {editable ? (
                    <Checkbox
                      checked={bankPicked.has(line.id)}
                      onCheckedChange={(checked) => setBankPicked((set) => toggle(set, line.id, checked === true))}
                      aria-label={t("workspace.pick", { description: line.description })}
                    />
                  ) : null}
                  <span className="w-20 shrink-0 text-muted-foreground">{formatCafeDayShort(line.date, locale)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground" dir="auto">
                      {line.description}
                    </span>
                    {line.reference ? (
                      <span className="block truncate text-body-caption text-muted-foreground" dir="ltr">
                        {line.reference}
                      </span>
                    ) : null}
                  </span>
                  <span className={cn("shrink-0", amountClass(line.amount))}>{formatMoney(line.amount, locale)}</span>
                  {editable ? (
                    <StatementLineActions
                      line={line}
                      disabled={pending}
                      onRecord={(values) => record(line.id, values)}
                      onRemove={() =>
                        run(async () => {
                          await bankStatementsApi.removeLine(statement.id, line.id);
                          return null;
                        }, t("workspace.removeError"))
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex min-w-0 flex-col rounded-card-lg border border-border bg-background">
          <h2 className="border-b border-border px-4 py-3 text-body-strong text-foreground">{t("workspace.bookSide", { count: openCandidates.length })}</h2>
          {openCandidates.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-small text-muted-foreground">{t("workspace.bookDone")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {openCandidates.map((candidate) => (
                <li key={candidate.lineId} className="flex items-center gap-3 px-4 py-2.5 text-body-small">
                  {editable ? (
                    <Checkbox
                      checked={bookPicked.has(candidate.lineId)}
                      onCheckedChange={(checked) => setBookPicked((set) => toggle(set, candidate.lineId, checked === true))}
                      aria-label={t("workspace.pick", { description: candidate.description })}
                    />
                  ) : null}
                  <span className={cn("w-20 shrink-0", candidate.date > statement.toDay ? "text-warning-foreground" : "text-muted-foreground")}>
                    {formatCafeDayShort(candidate.date, locale)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground" dir="auto">
                      {candidate.description}
                    </span>
                    <span className="block truncate text-body-caption text-muted-foreground">
                      <Link href={`/dashboard/accounting/journal/${candidate.entryId}`} className="text-primary underline-offset-4 hover:underline">
                        JE-{candidate.entryNumber}
                      </Link>{" "}
                      · {tAccounting(`source.${candidate.source}`)}
                    </span>
                  </span>
                  <span className={cn("shrink-0", amountClass(candidate.amount))}>{formatMoney(candidate.amount, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {matches.length > 0 ? (
        <section className="flex flex-col rounded-card-lg border border-border bg-background">
          <h2 className="border-b border-border px-4 py-3 text-body-strong text-foreground">{t("workspace.matched", { count: matches.length })}</h2>
          <ul className="divide-y divide-border">
            {matches.map((match) => (
              <li key={match.matchId} className="flex flex-wrap items-start gap-3 px-4 py-2.5 text-body-small">
                <div className="min-w-0 flex-1 basis-60">
                  {match.lines.map((line) => (
                    <p key={line.id} className="flex gap-2">
                      <span className="text-muted-foreground">{formatCafeDayShort(line.date, locale)}</span>
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        {line.description}
                      </span>
                      <span className={amountClass(line.amount)}>{formatMoney(line.amount, locale)}</span>
                    </p>
                  ))}
                </div>
                <div className="min-w-0 flex-1 basis-60 text-muted-foreground">
                  {match.ledger.map((candidate) => (
                    <p key={candidate.lineId} className="flex gap-2">
                      <Link href={`/dashboard/accounting/journal/${candidate.entryId}`} className="text-primary underline-offset-4 hover:underline">
                        JE-{candidate.entryNumber}
                      </Link>
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        {candidate.description}
                      </span>
                      <span>{formatMoney(candidate.amount, locale)}</span>
                    </p>
                  ))}
                </div>
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await bankStatementsApi.unmatch(statement.id, match.matchId);
                        return null;
                      }, t("workspace.matchError"))
                    }
                  >
                    <Icon icon={Unlink} size="sm" className="me-1.5" />
                    {t("workspace.unmatch")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
