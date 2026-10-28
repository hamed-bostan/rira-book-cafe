import { BookOpen } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, cafeDaysBetween } from "@/src/domain/entities/CafeTime";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { AddHoldDialog } from "./AddHoldDialog";
import { BookHoldActions } from "./BookHoldActions";

export const HOLD_TABS = ["open", "closed"] as const;
export type HoldTab = (typeof HOLD_TABS)[number];

type BookHoldsScreenProps = {
  /** Everyone in line, front of each line first. */
  open: BookWaitlistEntry[];
  /** Holds that closed lately (borrowed or cancelled). */
  closed: BookWaitlistEntry[];
  books: LendableBook[];
  /** Loans still out — when each book's next copy is due back. */
  openLoans: BookLoan[];
  tab: HoldTab;
  now: string;
  canManage: boolean;
};

const STATUS_VARIANT = { waiting: "neutral", notified: "success", fulfilled: "neutral", cancelled: "neutral" } as const;

/**
 * The lines for books that are out, one group per book: the copy's state (on the
 * shelf and held for someone, or out and when it's next back — or how late), then
 * the guests in order. The guest who was told it's back can be lent it or skipped;
 * anyone waiting can be taken off. Presentational: the page fetches over the REST
 * API (BFF); every action `router.refresh()`es.
 */
export async function BookHoldsScreen({ open, closed, books, openLoans, tab, now, canManage }: BookHoldsScreenProps) {
  const t = await getTranslations("dashBookHolds");
  const locale = await getLocale();
  const nowDate = new Date(now);
  const today = cafeDayOf(nowDate);

  const shown = tab === "open" ? open : closed;
  const bookById = new Map(books.map((book) => [book.id, book]));
  const lineFor = (productId: string): BookWaitlistEntry[] =>
    open.filter((entry) => entry.productId === productId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const productIds = [...new Set(shown.map((entry) => entry.productId))].sort((a, b) => {
    const readyA = open.some((entry) => entry.productId === a && entry.status === "notified");
    const readyB = open.some((entry) => entry.productId === b && entry.status === "notified");
    const titleOf = (id: string): string =>
      bookById.get(id)?.title ?? shown.find((entry) => entry.productId === id)?.bookTitle ?? "";
    return Number(readyB) - Number(readyA) || titleOf(a).localeCompare(titleOf(b));
  });

  function copyState(productId: string): { text: string; tone: string } {
    const book = bookById.get(productId);
    const copies = book?.copies ?? 1;
    const free = copies - (book?.onLoan ?? 0);
    const heldFor = open.find((entry) => entry.productId === productId && entry.status === "notified");
    if (free > 0) {
      return {
        text: heldFor
          ? t("onShelfHeld", { name: heldFor.guestName })
          : t("copiesOnShelf", { count: free, formatted: formatNumber(free, locale) }),
        tone: "font-medium text-success-foreground",
      };
    }
    const next = openLoans
      .filter((loan) => loan.productId === productId)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
    const out =
      copies === 1 ? t("outOnLoan") : t("allCopiesOut", { count: copies, formatted: formatNumber(copies, locale) });
    if (!next) return { text: out, tone: "text-muted-foreground" };
    const dueDay = formatCafeDayShort(cafeDayOf(new Date(next.dueAt)), locale);
    return new Date(next.dueAt) < nowDate
      ? {
          text: `${out} · ${t("overdueSince", { reference: next.reference, date: dueDay })}`,
          tone: "font-semibold text-error-foreground",
        }
      : { text: `${out} · ${t("nextBack", { date: dueDay })}`, tone: "text-muted-foreground" };
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        {canManage ? (
          <AddHoldDialog
            books={books.map((book) => ({
              id: book.id,
              title: book.title,
              free: book.copies - book.onLoan,
              inLine: lineFor(book.id).length,
            }))}
          />
        ) : null}
      </div>

      <section
        aria-label={t("holdsLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <DashboardLinkTabs
          className="px-4"
          label={t("tabsLabel")}
          current={tab}
          tabs={HOLD_TABS.map((value) => ({
            key: value,
            label: t(`tab.${value}`),
            count: value === "open" ? open.length : closed.length,
            href: value === "open" ? "/dashboard/book-holds" : `/dashboard/book-holds?tab=${value}`,
          }))}
        />

        {productIds.length > 0 ? (
          productIds.map((productId, groupIndex) => {
            const entries = shown
              .filter((entry) => entry.productId === productId)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            const book = bookById.get(productId);
            const state = copyState(productId);
            return (
              <div key={productId} className={cn(groupIndex > 0 && "border-t border-border")}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4 pb-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <Icon icon={BookOpen} size="icon-md" className="text-icon-accent" />
                    <span className="text-body-strong text-foreground">{book?.title ?? entries[0].bookTitle}</span>
                    {book?.author ? (
                      <span className="text-body-default text-muted-foreground sm:text-body-small">{book.author}</span>
                    ) : null}
                  </span>
                  <span className={cn("ms-auto text-body-small sm:text-body-caption", state.tone)}>{state.text}</span>
                </div>
                <ol className="flex flex-col px-5 pb-2">
                  {entries.map((entry, index) => {
                    const told = entry.status === "notified";
                    const toldDay = entry.notifiedAt ? cafeDayOf(new Date(entry.notifiedAt)) : today;
                    const ago = cafeDaysBetween(toldDay, today);
                    const nextInLine = lineFor(productId).find(
                      (other) => other.id !== entry.id && other.status === "waiting",
                    )?.guestName;
                    return (
                      <li
                        key={entry.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-4 gap-y-2 py-3",
                          index > 0 && "border-t border-border",
                          tab === "closed" && "opacity-70",
                        )}
                      >
                        {tab === "open" ? (
                          <span
                            title={t("positionTitle", { position: index + 1 })}
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-body-small font-semibold tabular-nums sm:text-body-caption",
                              told ? "bg-success text-success-foreground" : "bg-muted text-foreground/80",
                            )}
                          >
                            {formatNumber(index + 1, locale)}
                          </span>
                        ) : null}
                        <span className="flex min-w-0 flex-[1_1_12rem] flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-body-default font-medium text-foreground sm:text-body-small">
                              {entry.guestName}
                            </span>
                            <Badge variant={STATUS_VARIANT[entry.status]} appearance="outline" size="compact" dot>
                              {t(`status.${entry.status}`)}
                            </Badge>
                          </span>
                          <span className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
                            <span dir="ltr">{entry.guestPhone}</span> ·{" "}
                            {told
                              ? ago > 0
                                ? t("toldAgo", {
                                    date: formatCafeDayShort(toldDay, locale),
                                    days: ago,
                                    formatted: formatNumber(ago, locale),
                                  })
                                : t("toldOn", { date: formatCafeDayShort(toldDay, locale) })
                              : t("joinedOn", {
                                  date: formatCafeDayShort(cafeDayOf(new Date(entry.createdAt)), locale),
                                })}
                          </span>
                        </span>
                        {canManage && tab === "open" ? (
                          <BookHoldActions
                            entry={entry}
                            title={book?.title ?? entry.bookTitle}
                            nextInLine={nextInLine}
                            today={today}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })
        ) : (
          <DashboardEmptyState
            title={tab === "open" ? t("emptyOpenTitle") : t("emptyClosedTitle")}
            body={tab === "open" ? t("emptyOpenBody") : t("emptyClosedBody")}
          />
        )}
      </section>
    </div>
  );
}
