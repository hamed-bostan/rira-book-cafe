import { getLocale, getTranslations } from "next-intl/server";

import {
  ACTIVITY_ACTIONS,
  FILTERABLE_ACTIVITY_FIELDS,
  SYSTEM_ACTOR,
  type ActivityEntityType,
} from "@/src/domain/entities/ActivityEntry";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium, formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { cn } from "@/src/lib/utils";
import { DashboardEmptyState } from "@/src/presentation/dashboard/DashboardEmptyState";
import { ListPager, ListSearchInput } from "@/src/presentation/dashboard/list";
import type { RoleNames } from "@/src/presentation/dashboard/team/roleDisplay";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { ActivityDateRange } from "./ActivityDateRange";
import { activityDayKind, groupByCafeDay } from "./activityDays";
import { ActivityEntryRow } from "./ActivityEntryRow";
import { ActivityExportLink } from "./ActivityExportLink";
import { ActivityFilterSelect, type ActivityFilterGroup } from "./ActivityFilterSelect";

/** The translator through a signature that takes a runtime-built key, checked by `has` (see `ActivityEntryRow`). */
type LooseTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

import type { ActivityActorWire, ActivityEntryWire } from "./activity-response-schema";

type ActivityScreenProps = {
  /** One page of the log, newest first. */
  entries: Page<ActivityEntryWire>;
  /** The people who appear in the log, for the "Changed by" filter. */
  actors: ActivityActorWire[];
  /** The kinds of entry this viewer may read, so the filter offers nothing they can't open. */
  entityTypes: readonly ActivityEntityType[];
  /** Whether a filter is narrowing the log, to tell "nothing here" from "nothing matched". */
  isFiltered: boolean;
  /** Custom roles' names, for the role-change entries only the owner reads. */
  roleNames?: RoleNames;
};

/**
 * The "What happened" filter's options, grouped under the areas this viewer may
 * read. Each action's name comes from `actionName`; one this build has no name for
 * (added by a newer feature) reads as its key rather than breaking the page.
 */
function actionGroups(
  entityTypes: readonly ActivityEntityType[],
  areaLabel: (type: ActivityEntityType) => string,
  actionLabel: (action: string) => string,
): ActivityFilterGroup[] {
  return entityTypes
    .map((type) => ({
      label: areaLabel(type),
      options: ACTIVITY_ACTIONS.filter((action) => action.startsWith(`${type}.`)).map((action) => ({
        value: action,
        label: actionLabel(action),
      })),
    }))
    .filter((group) => group.options.length > 0);
}

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
 * Beside the exact filters (who, what kind of thing, what happened, which value
 * moved) there's a span of days and a search over what entries name — the item's
 * label and who made the change — and the filtered log downloads as CSV.
 */
export async function ActivityScreen({
  entries,
  actors,
  entityTypes,
  isFiltered,
  roleNames = {},
}: ActivityScreenProps) {
  const t = await getTranslations("dashActivity");
  const locale = await getLocale();
  const loose = t as unknown as LooseTranslator;
  const actionLabel = (action: string): string => {
    const key = `actionName.${action}`;
    return loose.has(key) ? loose(key) : action;
  };

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
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("summary")}</p>
        </div>
        <ActivityExportLink />
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
              ...actors.map((actor) => ({
                value: actor.id,
                label: actor.id === SYSTEM_ACTOR.id ? t("systemActor") : actor.name,
              })),
            ]}
          />
          <ActivityFilterSelect
            paramName="entityType"
            label={t("filterEntity")}
            options={[
              { value: "", label: t("allEntities") },
              ...entityTypes.map((type) => ({ value: type, label: t(`entity.${type}`) })),
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
          <ActivityFilterSelect
            paramName="action"
            label={t("filterAction")}
            options={[{ value: "", label: t("allActions") }]}
            groups={actionGroups(entityTypes, (type) => t(`entity.${type}`), actionLabel)}
          />
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-2">
            <span className="text-body-default font-medium text-foreground sm:text-body-small">{t("searchLabel")}</span>
            <ListSearchInput label={t("searchLabel")} placeholder={t("searchPlaceholder")} />
          </div>
          <ActivityDateRange />
        </div>

        {groups.length > 0 ? (
          <>
            {groups.map((group, index) => (
              <div key={group.day}>
                <h2
                  className={cn(
                    "border-b border-border bg-muted px-5 py-2 text-body-caption font-semibold tracking-wider text-muted-foreground uppercase",
                    index > 0 && "border-t",
                  )}
                >
                  {dayLabel(group.day)}
                </h2>
                <ol>
                  {group.entries.map((entry, row) => (
                    <li key={entry.id} className={cn(row > 0 && "border-t border-border")}>
                      <ActivityEntryRow entry={entry} time={timeOf(entry, group.day)} roleNames={roleNames} />
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
          <DashboardEmptyState
            title={t("noMatchesTitle")}
            body={t("noMatchesBody")}
            action={
              <Button asChild size="control-md" variant="secondary" className="px-3">
                <Link href="/dashboard/activity">{t("clearFilters")}</Link>
              </Button>
            }
          />
        ) : (
          <DashboardEmptyState title={t("empty")} body={t("emptyBody")} />
        )}
      </section>
    </div>
  );
}
