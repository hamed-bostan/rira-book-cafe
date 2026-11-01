import { getLocale } from "next-intl/server";

import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { DashboardTimelineItem } from "@/src/presentation/dashboard/DashboardTimelineItem";

import { ActivityEntryRow } from "./ActivityEntryRow";

import type { ActivityEntryWire } from "./activity-response-schema";

type ActivityListProps = {
  /** One entity's entries, newest first. */
  entries: ActivityEntryWire[];
};

/**
 * One entity's history as a timeline — the per-entity panels' body. Every row is
 * about the same thing, so rows don't name it; times read as "2 days ago", which is
 * the question beside a form ("when did this last change?").
 */
export async function ActivityList({ entries }: ActivityListProps) {
  const locale = await getLocale();

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => (
        <DashboardTimelineItem key={entry.id} current={index === 0} last={index === entries.length - 1}>
          <ActivityEntryRow entry={entry} time={formatRelativeTime(entry.at, locale)} showEntity={false} timeline />
        </DashboardTimelineItem>
      ))}
    </ol>
  );
}
