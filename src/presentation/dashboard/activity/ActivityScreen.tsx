import { History, SearchX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ACTIVITY_ENTITY_TYPES, FILTERABLE_ACTIVITY_FIELDS } from "@/src/domain/entities/ActivityEntry";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium, formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { cn } from "@/src/lib/utils";
import { ListPager } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { activityDayKind, groupByCafeDay } from "./activityDays";
import { ActivityEntryRow } from "./ActivityEntryRow";
import { ActivityFilterSelect } from "./ActivityFilterSelect";

import type { ActivityActorWire, ActivityEntryWire } from "./activity-response-schema";

type ActivityScreenProps = {
  /** One page of the log, newest first. */
  entries: Page<ActivityEntryWire>;
  /** The people who appear in the log, for the "Changed by" filter. */
  actors: ActivityActorWire[];
  /** Whether a filter is narrowing the log, to tell "nothing here" from "nothing matched". */
  isFiltered: boolean;
};

/**
 * The admin audit trail: every change anyone made, newest first, under a header
 * per day, filterable by who made it, the area it was made in, and the field that
 * moved.
 *
 * Presentational, and a server component: the filters and the page live in the
 * URL, so changing either is a navigation that re-runs the server render. Nothing
 * here holds data state, and nothing here writes — the log has no controls at all,
 * which is the design.
 *
 * There is no search box. The log's text is a rendering of actions and ids, not
 * prose, so a free-text search over it would mostly match on fragments of uuids;
 * the three filters that matter — who, what kind of thing, and which value moved
 * — are exact.
 */
export async function ActivityScreen({ entries, actors, isFiltered }: ActivityScreenProps) {
  const t = await getTranslations("dashActivity");
  const locale = await getLocale();

  const today = cafeDayOf(new Date());
  const dayLabel = (day: string): string => {
    const kind = activityDayKind(day, today);
    if (kind === "today" || kind === "yesterday") return t(`day.${kind}`);
    return kind === "recent" ? formatCafeDayShort(day, locale) : formatCafeDayMedium(day, locale);
  };
  // Today's changes read by how long ago they were; an earlier day's header
  // already says the date, so its rows only need the clock.
  const timeOf = (entry: ActivityEntryWire, day: string): string =>
    day === today ? formatRelativeTime(entry.at, locale) : formatOrderTime(entry.at, locale);

  const groups = groupByCafeDay(entries.items);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("summary")}</p>
      </div>

      <section
        aria-label={t("listLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <div className="grid gap-x-4 gap-y-3 border-b border-border px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActivityFilterSelect
            paramName="actorId"
            label={t("filterActor")}
            options={[
              { value: "", label: t("allActors") },
              ...actors.map((actor) => ({ value: actor.id, label: actor.name })),
            ]}
          />
          <ActivityFilterSelect
            paramName="entityType"
            label={t("filterEntity")}
            options={[
              { value: "", label: t("allEntities") },
              ...ACTIVITY_ENTITY_TYPES.map((type) => ({ value: type, label: t(`entity.${type}`) })),
            ]}
          />
          {/* Filters on the *diff*, not the action — which is what lets a save
              stay one entry while "show me every price change" is still a
              question with an answer. Backed by the GIN index on
              `changed_fields`, so it's a real query rather than a scan. */}
          <ActivityFilterSelect
            paramName="field"
            label={t("filterField")}
            options={[
              { value: "", label: t("allFields") },
              ...FILTERABLE_ACTIVITY_FIELDS.map((field) => ({ value: field, label: t(`field.${field}`) })),
            ]}
          />
        </div>

        {groups.length > 0 ? (
          <>
            {groups.map((group, index) => (
              <div key={group.day}>
                <h2
                  className={cn(
                    "border-b border-border bg-muted px-5 py-2 text-body-caption-bold tracking-wider text-muted-foreground uppercase",
                    index > 0 && "border-t",
                  )}
                >
                  {dayLabel(group.day)}
                </h2>
                <ol>
                  {group.entries.map((entry, row) => (
                    <li key={entry.id} className={cn(row > 0 && "border-t border-border")}>
                      <ActivityEntryRow entry={entry} time={timeOf(entry, group.day)} />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div className="border-t border-border px-5 py-3">
              <ListPager page={entries} />
            </div>
          </>
        ) : isFiltered ? (
          <EmptyState
            icon={SearchX}
            title={t("noMatchesTitle")}
            description={t("noMatchesBody")}
            action={
              <Button asChild size="control-md" variant="secondary" className="px-3">
                <Link href="/dashboard/activity">{t("clearFilters")}</Link>
              </Button>
            }
            className="py-12"
          />
        ) : (
          <EmptyState icon={History} title={t("empty")} description={t("emptyBody")} className="py-12" />
        )}
      </section>
    </div>
  );
}
