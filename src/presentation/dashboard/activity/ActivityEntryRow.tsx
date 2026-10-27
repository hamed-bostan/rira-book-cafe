import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { roleChangeKind } from "@/src/domain/entities/RoleChange";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { activityEntityHref } from "./activityLinks";

import type { ActivityEntryWire } from "./activity-response-schema";
import type { ReactNode } from "react";

type ActivityEntryRowProps = {
  entry: ActivityEntryWire;
  /** When it happened, the way the list around it reads time ("8 minutes ago", "09:40 PM"). */
  time: string;
  /**
   * Name the area and link to the thing. Off inside a per-entity panel, where
   * every row is about the same thing and repeating it says nothing.
   */
  showEntity?: boolean;
};

/** Two leading initials, e.g. "Sara Ahmadi" → "SA". */
function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * One entry of the log: who made the change (their initials, then their name
 * leading the sentence), the area and when, a way to the thing changed, and the
 * values that moved.
 *
 * Shared by the activity page and the per-entity panels, so an entry reads the
 * same wherever it's shown. Read-only: there is nothing here to edit or delete,
 * because a record an admin can quietly tidy up isn't one.
 */
export async function ActivityEntryRow({ entry, time, showEntity = true }: ActivityEntryRowProps) {
  const t = await getTranslations("dashActivity");
  const locale = await getLocale();

  const href = showEntity ? activityEntityHref(entry.entityType, entry.entityId, entry.action) : null;
  const label = entry.entityLabel ?? entry.entityId;
  const actor = (chunks: ReactNode) => <span className="font-semibold">{chunks}</span>;

  // Role changes get the sentence the team page always used ("X gave Y admin
  // access") rather than the generic "X changed Y", because the roles carry the
  // meaning and a diff reading `customer → admin` makes the reader translate it.
  const sentence =
    entry.action === "user.roleChanged"
      ? t.rich(`role.${roleChangeKind({ userId: entry.entityId, actorId: entry.actorId, changes: entry.changes })}`, {
          actor: entry.actorName,
          user: label,
          b: actor,
        })
      : t.rich(`action.${entry.action}`, { actor: entry.actorName, entity: label, b: actor });

  return (
    <div className="flex gap-4 px-5 py-4">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-body-caption-bold text-accent-foreground"
      >
        {initials(entry.actorName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {showEntity ? (
            <Badge variant="neutral" appearance="outline" className="rounded-button font-semibold whitespace-nowrap">
              {t(`entity.${entry.entityType}`)}
            </Badge>
          ) : null}
          <time
            dateTime={entry.at}
            title={
              new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
                new Date(entry.at),
              ) + " UTC"
            }
            className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption"
          >
            {time}
          </time>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="min-w-0 text-body-default text-pretty [overflow-wrap:anywhere] text-foreground sm:text-body-small">
            {sentence}
          </p>
          {href ? (
            <Link
              href={href}
              aria-label={t("openAria", { entity: label })}
              className={cn(
                "-my-3 inline-flex shrink-0 items-center gap-1 rounded-button py-3 text-body-default font-medium whitespace-nowrap text-primary transition-colors hover:text-primary-hover sm:my-0 sm:py-0 sm:text-body-small",
                focusRing,
              )}
            >
              {t("open")}
              <Icon icon={ArrowUpRight} size="xs" className="rtl:-scale-x-100" />
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
    </div>
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
 * price. A dash on the before side isn't struck: nothing was there to remove.
 */
function ActivityDiff({
  changes,
  fieldLabel,
}: {
  changes: ActivityEntryWire["changes"];
  fieldLabel: (field: string) => string;
}) {
  return (
    <ul className="rounded-button border border-border bg-surface px-3 text-body-default sm:text-body-small">
      {changes.map((change, index) => (
        <li
          key={change.field}
          className={cn(
            "flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 [overflow-wrap:anywhere]",
            index > 0 && "border-t border-border",
          )}
        >
          <span className="w-full shrink-0 font-medium text-foreground sm:w-24">{fieldLabel(change.field)}</span>
          <span className={cn("text-muted-foreground", change.before !== null && "line-through")}>
            {change.before ?? "—"}
          </span>
          <span aria-hidden className="text-muted-foreground rtl:-scale-x-100">
            →
          </span>
          <span className="rounded-button bg-accent px-1.5 font-medium text-accent-foreground">
            {change.after ?? "—"}
          </span>
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
