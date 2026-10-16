import { ArrowUpRight, History } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { roleChangeKind } from "@/src/domain/entities/RoleChange";
import { Link } from "@/src/i18n/navigation";
import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { DataTable } from "@/src/presentation/design-system";

import { activityEntityHref } from "./activityLinks";

import type { ActivityEntryWire } from "./activity-response-schema";
import type { ReactNode } from "react";

type ActivityListProps = {
  entries: ActivityEntryWire[];
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  footer?: ReactNode;
  /**
   * Whether to name the entity in each row. Off inside a per-entity panel, where
   * every row is about the same thing and repeating its name down the column says
   * nothing.
   */
  showEntity?: boolean;
};

/**
 * The activity log rendered as a list of sentences with their diffs.
 *
 * Shared by the activity page and the per-entity panels so an entry reads the same
 * wherever it's shown. Deliberately an ordered list inside the admin card frame
 * rather than a table — the same call `TeamActivity` and `StockMovementHistory`
 * make, and for the same reason: a log entry is one sentence plus a small diff,
 * and columns wide enough for a product name and a description are columns mostly
 * full of whitespace.
 *
 * Read-only, and there is nothing here to edit or delete. A record an admin can
 * quietly tidy up isn't one.
 */
export async function ActivityList({ entries, toolbar, emptyState, footer, showEntity = true }: ActivityListProps) {
  const t = await getTranslations("dashActivity");
  const locale = (await getLocale());

  return (
    <DataTable toolbar={toolbar} footer={entries.length > 0 ? footer : undefined}>
      {entries.length > 0 ? (
      <ol className="divide-y divide-border">
        {entries.map((entry) => {
          const href = activityEntityHref(entry.entityType, entry.entityId, entry.action);
          const label = entry.entityLabel ?? entry.entityId;

          // Role changes get the sentence the team page always used ("X gave Y
          // admin access") rather than the generic "X changed Y", because the
          // roles carry the meaning and a diff reading `customer → admin` makes
          // the reader do the translation themselves.
          const sentence =
            entry.action === "user.roleChanged"
              ? t(
                  `role.${roleChangeKind({
                    userId: entry.entityId,
                    actorId: entry.actorId,
                    changes: entry.changes,
                  })}`,
                  { actor: entry.actorName, user: label },
                )
              : t(`action.${entry.action}`, { actor: entry.actorName, entity: label });

          return (
            <li key={entry.id} className="flex gap-3 bg-background px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
              <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                <History className="size-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {showEntity ? <span className="rounded-badge-md bg-surface-sunken px-2 py-1 text-body-caption text-foreground">{t(`entity.${entry.entityType}`)}</span> : null}
                <time dateTime={entry.at} title={new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(entry.at)) + " UTC"} className="text-body-small-strong tabular-nums text-muted-foreground sm:ms-auto">
                  {formatRelativeTime(entry.at, locale)}
                </time>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <span className="min-w-0 break-words text-body-small leading-relaxed text-foreground [overflow-wrap:anywhere]">
                  {sentence}
                </span>
                  {showEntity && href ? (
                    <Link href={href} aria-label={`${t("open")}: ${label}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md text-body-small-strong text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:min-h-8">
                      {t("open")}
                      <ArrowUpRight aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
                    </Link>
                  ) : null}
              </div>

              {entry.changes.length > 0 ? (
                <ActivityDiff
                  changes={entry.changes}
                  fieldLabel={(field) => fieldLabel(t as unknown as LooseTranslator, field)}
                />
              ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      ) : (
        emptyState
      )}
    </DataTable>
  );
}

/**
 * The fields that moved, as `label: before → after`.
 *
 * `before` is struck through rather than merely placed first: the whole reason to
 * open this log is to find a value that used to be something else, and the eye
 * should land on which of the two is gone without reading the arrow.
 *
 * A `null` side reads as an em dash — "not set", which is different from empty and
 * different from zero, and the three are worth telling apart when the field is a
 * price.
 */
function ActivityDiff({
  changes,
  fieldLabel,
}: {
  changes: ActivityEntryWire["changes"];
  fieldLabel: (field: string) => string;
}) {
  return (
    <ul className="divide-y divide-border/60 rounded-card-md border border-border/70 bg-surface px-3">
      {changes.map((change) => (
        <li key={change.field} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-body-small-strong [overflow-wrap:anywhere]">
          <span className="w-full shrink-0 text-foreground sm:w-32">{fieldLabel(change.field)}</span>
          {change.before !== null ? (
            <span className="text-muted-foreground line-through">{change.before}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <span aria-hidden className="text-muted-foreground rtl:-scale-x-100">
            →
          </span>
          <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">{change.after ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The translator, seen through a signature that accepts a runtime-built key.
 *
 * next-intl types `t` and `t.has` against the literal keys in `messages/*.json`,
 * which is exactly what we want everywhere else and can't work here: the key comes
 * from a `field` string chosen by a use-case, and the whole point of `has` is to
 * ask about a key that might not exist. The cast is confined to this one lookup
 * and is checked at runtime by the `has` call it enables.
 */
type LooseTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

/**
 * A readable name for a diffed field, falling back to the raw key.
 *
 * The fallback is what keeps this from being a maintenance trap: a use-case that
 * starts recording a new field renders it as `nutritionNotes` — ugly, but present
 * and honest — instead of throwing a missing-message error that takes the whole
 * page down. Translating it is then a follow-up, not a prerequisite.
 */
function fieldLabel(t: LooseTranslator, field: string): string {
  const key = `field.${field}`;
  return t.has(key) ? t(key) : field;
}
