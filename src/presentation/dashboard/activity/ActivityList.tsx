import { getLocale } from "next-intl/server";

import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { DataTable } from "@/src/presentation/design-system/components/DataTable/DataTable";

import { ActivityEntryRow } from "./ActivityEntryRow";

import type { ActivityEntryWire } from "./activity-response-schema";

type ActivityListProps = {
  /** One entity's entries, newest first. */
  entries: ActivityEntryWire[];
};

/**
 * One entity's history as a list inside the admin card frame — the per-entity
 * panels' body. Every row is about the same thing, so rows don't name it; times
 * read as "2 days ago", which is the question beside a form ("when did this
 * last change?").
 */
export async function ActivityList({ entries }: ActivityListProps) {
  const locale = await getLocale();

  return (
    <DataTable>
      <ol className="divide-y divide-border bg-background">
        {entries.map((entry) => (
          <li key={entry.id}>
            <ActivityEntryRow entry={entry} time={formatRelativeTime(entry.at, locale)} showEntity={false} />
          </li>
        ))}
      </ol>
    </DataTable>
  );
}
