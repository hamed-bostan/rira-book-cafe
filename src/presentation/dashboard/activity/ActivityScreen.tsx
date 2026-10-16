import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  ACTIVITY_ENTITY_TYPES,
  FILTERABLE_ACTIVITY_FIELDS,
} from "@/src/domain/entities/ActivityEntry";
import type { Page } from "@/src/domain/entities/Pagination";
import { ListFilterSelect, ListPager } from "@/src/presentation/dashboard/list";

import { ActivityList } from "./ActivityList";

import type { ActivityActorWire, ActivityEntryWire } from "./activity-response-schema";

type ActivityScreenProps = {
  /** One page of the log, newest first. */
  entries: Page<ActivityEntryWire>;
  /** The people who appear in the log, for the actor filter. */
  actors: ActivityActorWire[];
  /** Whether a filter is narrowing the log, to tell "nothing here" from "nothing matched". */
  isFiltered: boolean;
};

/**
 * The admin audit trail: every change anyone made, newest first, filterable by who
 * made it and what kind of thing it was made to.
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
  const tList = await getTranslations("dashList");

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="mt-1 text-body-small leading-relaxed text-muted-foreground">{t("summary")}</p>
      </div>

      <ActivityList
        entries={entries.items}
        toolbar={(
          <section aria-label={t("heading")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            <label className="flex min-w-0 flex-col gap-1.5 text-body-small-strong font-medium text-muted-foreground">
              <span>{t("filterActor")}</span>
              <ListFilterSelect
                className="h-11 w-full min-w-0 bg-surface text-body-small-emphasis sm:h-10"
                paramName="actorId"
                label={t("filterActor")}
                options={[
                  { value: "", label: t("allActors") },
                  ...actors.map((actor) => ({ value: actor.id, label: actor.name })),
                ]}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-body-small-strong font-medium text-muted-foreground">
              <span>{t("filterEntity")}</span>
              <ListFilterSelect
                className="h-11 w-full min-w-0 bg-surface text-body-small-emphasis sm:h-10"
                paramName="entityType"
                label={t("filterEntity")}
                options={[
                  { value: "", label: t("allEntities") },
                  ...ACTIVITY_ENTITY_TYPES.map((type) => ({
                    value: type,
                    label: t(`entity.${type}`),
                  })),
                ]}
              />
            </label>
            {/* Filters on the *diff*, not the action — which is what lets a save
                stay one entry while "show me every price change" is still a
                question with an answer. Backed by the GIN index on
                `changed_fields`, so it's a real query rather than a scan. */}
            <label className="flex min-w-0 flex-col gap-1.5 text-body-small-strong font-medium text-muted-foreground">
              <span>{t("filterField")}</span>
              <ListFilterSelect
                className="h-11 w-full min-w-0 bg-surface text-body-small-emphasis sm:h-10"
                paramName="field"
                label={t("filterField")}
                options={[
                  { value: "", label: t("allFields") },
                  ...FILTERABLE_ACTIVITY_FIELDS.map((field) => ({
                    value: field,
                    label: t(`fieldOption.${field}`),
                  })),
                ]}
              />
            </label>
          </section>
        )}
        emptyState={(
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground">
              <History aria-hidden="true" className="size-5" />
            </div>
            <p className="text-body-strong text-foreground">
              {isFiltered ? tList("noResultsTitle") : t("empty")}
            </p>
            <p className="mt-1 text-body-small text-muted-foreground">
              {isFiltered ? tList("noResultsBody") : t("emptyBody")}
            </p>
          </div>
        )}
        footer={<ListPager page={entries} />}
      />
    </div>
  );
}
