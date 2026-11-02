"use client";

import { Wand2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { RecordStatementLineInput } from "@/src/contracts/bank-schema";
import type { BankStatement, LedgerCandidate, MatchPair } from "@/src/domain/entities/BankReconciliation";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { Spinner } from "@/src/presentation/design-system/components/Spinner/Spinner";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardSection } from "../DashboardSection";
import { TEXT_ACTION } from "../fieldStyles";
import { AMOUNT, GROUP_BAND, PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { bankStatementsApi } from "./bank-statement-api";
import { MatchLine } from "./MatchLine";
import { StatementLineActions } from "./StatementLineActions";

type BankMatchWorkspaceProps = {
  statement: BankStatement;
  candidates: LedgerCandidate[];
  suggestions: MatchPair[];
  canWrite: boolean;
};

/** Which workspace action is running, so only its button shows the spinner. */
type WorkspaceAction = "autoMatch" | "match" | `unmatch:${string}` | `line:${string}`;

const sum = (amounts: readonly number[]): number => amounts.reduce((total, amount) => total + amount, 0);

/** A band over one side of the workspace, a step tighter than a full-width group. */
const SIDE_BAND = cn(GROUP_BAND, "px-4");

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
  const { toast } = useToast();
  const [active, setActive] = React.useState<WorkspaceAction | null>(null);
  const [pending, startTransition] = React.useTransition();

  const editable = canWrite && statement.status === "open";
  const openLines = statement.lines.filter((line) => !line.matchId);
  const openCandidates = candidates.filter((candidate) => !candidate.matchId);
  const bankTotal = sum(openLines.filter((line) => bankPicked.has(line.id)).map((line) => line.amount));
  const bookTotal = sum(
    openCandidates.filter((candidate) => bookPicked.has(candidate.lineId)).map((candidate) => candidate.amount),
  );
  const canMatch = editable && bankPicked.size > 0 && bookPicked.size > 0 && bankTotal === bookTotal;

  const matchIds = [...new Set(statement.lines.flatMap((line) => (line.matchId ? [line.matchId] : [])))];
  const matches = matchIds.map((matchId) => ({
    matchId,
    lines: statement.lines.filter((line) => line.matchId === matchId),
    ledger: candidates.filter((candidate) => candidate.matchId === matchId),
  }));

  function run(which: WorkspaceAction, action: () => Promise<string>, fallback: string): void {
    setActive(which);
    startTransition(async () => {
      try {
        const message = await action();
        setBankPicked(new Set());
        setBookPicked(new Set());
        toast({ tone: "success", title: message });
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, fallback) });
      }
    });
  }

  const isRunning = (which: WorkspaceAction): boolean => pending && active === which;

  const toggle = (set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const record = (lineId: string, values: RecordStatementLineInput): void =>
    run(
      `line:${lineId}`,
      async () => {
        const entry = await bankStatementsApi.recordLine(statement.id, lineId, values);
        return t("workspace.recorded", { number: entry.number });
      },
      t("workspace.recordError"),
    );

  const signed = (amount: number): string => `${amount > 0 ? "+" : ""}${formatNumber(amount, locale)}`;

  return (
    <div className={cn(ROW_TEXT, "flex min-w-0 flex-col gap-4")}>
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {suggestions.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-3"
              loading={isRunning("autoMatch")}
              disabled={pending}
              onClick={() =>
                run(
                  "autoMatch",
                  async () => t("workspace.autoMatched", { count: await bankStatementsApi.autoMatch(statement.id) }),
                  t("workspace.matchError"),
                )
              }
            >
              <Icon icon={Wand2} size="icon-md" className="me-2" />
              {t("workspace.autoMatch", { count: suggestions.length })}
            </Button>
          ) : null}
          <div className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-foreground/80 tabular-nums">
              {t("workspace.selection", { bank: signed(bankTotal), books: signed(bookTotal) })}
            </span>
            <Button
              type="button"
              size="control-md"
              className="px-4"
              loading={isRunning("match")}
              disabled={!canMatch || pending}
              onClick={() =>
                run(
                  "match",
                  async () => {
                    await bankStatementsApi.match(statement.id, {
                      statementLineIds: [...bankPicked],
                      ledgerLineIds: [...bookPicked],
                    });
                    return t("workspace.matchedToast");
                  },
                  t("workspace.matchError"),
                )
              }
            >
              {t("workspace.match")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className={cn(PAGE_CARD, "flex flex-col overflow-hidden")}>
          <h2 className={SIDE_BAND}>{t("workspace.bankSide", { count: openLines.length })}</h2>
          {openLines.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t("workspace.bankDone")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {openLines.map((line) => (
                <li key={line.id}>
                  <MatchLine
                    description={line.description}
                    meta={
                      <>
                        {formatCafeDayShort(line.date, locale)}
                        {line.reference ? (
                          <>
                            {" · "}
                            <bdi>{line.reference}</bdi>
                          </>
                        ) : null}
                      </>
                    }
                    amount={signed(line.amount)}
                    moneyIn={line.amount > 0}
                    picked={bankPicked.has(line.id)}
                    disabled={!editable}
                    pickLabel={t("workspace.pick", { description: line.description })}
                    onPickedChange={(on) => setBankPicked((set) => toggle(set, line.id, on))}
                    end={
                      editable ? (
                        <StatementLineActions
                          line={line}
                          disabled={pending}
                          busy={isRunning(`line:${line.id}`)}
                          onRecord={(values) => record(line.id, values)}
                          onRemove={() =>
                            run(
                              `line:${line.id}`,
                              async () => {
                                await bankStatementsApi.removeLine(statement.id, line.id);
                                return t("workspace.lineRemoved");
                              },
                              t("workspace.removeError"),
                            )
                          }
                        />
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn(PAGE_CARD, "flex flex-col overflow-hidden")}>
          <h2 className={SIDE_BAND}>{t("workspace.bookSide", { count: openCandidates.length })}</h2>
          {openCandidates.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t("workspace.bookDone")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {openCandidates.map((candidate) => (
                <li key={candidate.lineId}>
                  <MatchLine
                    description={candidate.description}
                    meta={`${formatCafeDayShort(candidate.date, locale)} · ${tAccounting(`source.${candidate.source}`)}`}
                    late={candidate.date > statement.toDay}
                    amount={signed(candidate.amount)}
                    moneyIn={candidate.amount > 0}
                    picked={bookPicked.has(candidate.lineId)}
                    disabled={!editable}
                    pickLabel={t("workspace.pick", { description: candidate.description })}
                    onPickedChange={(on) => setBookPicked((set) => toggle(set, candidate.lineId, on))}
                    end={
                      <Link
                        href={`/dashboard/accounting/journal/${candidate.entryId}`}
                        className="-my-3 shrink-0 py-3 font-medium whitespace-nowrap text-primary hover:text-primary-hover sm:my-0 sm:py-0"
                      >
                        JE-{candidate.entryNumber}
                      </Link>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DashboardSection title={t("workspace.matched", { count: matches.length })} className="overflow-hidden" flush>
        <ul className="divide-y divide-border">
          {matches.map((match) => (
            <li key={match.matchId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground" dir="auto">
                  {match.lines.map((line) => line.description).join(locale === "fa" ? "، " : ", ")}
                </span>
                <span className={cn(ROW_CAPTION, "flex flex-wrap gap-1")}>
                  <span>
                    {t("workspace.matchedTo", {
                      date: match.lines[0] ? formatCafeDayShort(match.lines[0].date, locale) : "",
                    })}
                  </span>
                  {match.ledger.map((candidate) => (
                    <Link
                      key={candidate.lineId}
                      href={`/dashboard/accounting/journal/${candidate.entryId}`}
                      className="text-primary hover:text-primary-hover"
                    >
                      JE-{candidate.entryNumber}
                    </Link>
                  ))}
                </span>
              </span>
              <span className={cn(AMOUNT, "font-semibold text-foreground")}>
                {signed(sum(match.lines.map((line) => line.amount)))}
              </span>
              {editable ? (
                <button
                  type="button"
                  className={cn(
                    TEXT_ACTION,
                    focusRing,
                    "flex items-center gap-1.5 text-primary hover:text-primary-hover",
                  )}
                  disabled={pending}
                  onClick={() =>
                    run(
                      `unmatch:${match.matchId}`,
                      async () => {
                        await bankStatementsApi.unmatch(statement.id, match.matchId);
                        return t("workspace.unmatchedToast");
                      },
                      t("workspace.matchError"),
                    )
                  }
                >
                  {isRunning(`unmatch:${match.matchId}`) ? <Spinner size="xs" decorative /> : null}
                  {t("workspace.unmatch")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </DashboardSection>
    </div>
  );
}
