import { getLocale, getTranslations } from "next-intl/server";

import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { Badge } from "@/src/presentation/design-system";

import { RemoveWaitlistEntryButton } from "./RemoveWaitlistEntryButton";

type BookWaitlistSectionProps = {
  /** Open entries, grouped by book and front of each line first (as the API returns them). */
  entries: BookWaitlistEntry[];
  canManage: boolean;
};

/**
 * Who's waiting for which book: the front of each line is told on their account
 * when a copy comes back, and lending the book to them takes them off it.
 */
export async function BookWaitlistSection({ entries, canManage }: BookWaitlistSectionProps) {
  const t = await getTranslations("dashBookLoans");
  const locale = await getLocale();
  if (entries.length === 0) return null;

  const byBook = new Map<string, BookWaitlistEntry[]>();
  for (const entry of entries) byBook.set(entry.productId, [...(byBook.get(entry.productId) ?? []), entry]);

  return (
    <section className="flex flex-col gap-3 rounded-card-lg border border-border p-4">
      <div>
        <h2 className="text-body-strong text-foreground">{t("waitlistHeading")}</h2>
        <p className="text-body-small text-muted-foreground">{t("waitlistSubtitle")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {[...byBook.values()].map((line) => (
          <li key={line[0].productId} className="flex flex-col gap-1.5">
            <p className="text-body-small-strong text-foreground">{line[0].bookTitle}</p>
            <ol className="flex flex-col gap-1">
              {line.map((entry, index) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 text-body-small text-foreground">
                  <span className="w-5 text-muted-foreground tabular-nums">{formatNumber(index + 1, locale)}.</span>
                  <span>{entry.guestName}</span>
                  <span dir="ltr" className="text-muted-foreground">
                    {entry.guestPhone}
                  </span>
                  <span className="text-body-caption text-muted-foreground">{formatOrderDateShort(entry.createdAt, locale)}</span>
                  {entry.status === "notified" ? <Badge variant="success">{t("waitlistNotified")}</Badge> : null}
                  {canManage ? <RemoveWaitlistEntryButton entryId={entry.id} guestName={entry.guestName} /> : null}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}
