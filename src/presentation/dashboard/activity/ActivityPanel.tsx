import { getTranslations } from "next-intl/server";

import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";

import { ActivityList } from "./ActivityList";

import type { ActivityEntryWire } from "./activity-response-schema";

type ActivityPanelProps = {
  /** This entity's recent entries, newest first. */
  entries: ActivityEntryWire[];
};

/**
 * One entity's activity, as a panel on its detail screen.
 *
 * The counterpart to the activity page: that answers "what happened today", this
 * answers "what happened to *this*" — which is the question someone actually has
 * while looking at the item whose price nobody can explain. Finding it by filtering the global log would mean
 * knowing the id and leaving the screen you're on.
 *
 * Sits in the narrow column, beside the form: the screen around it is what the thing
 * *is*, this is what has been done to it.
 */
export async function ActivityPanel({ entries }: ActivityPanelProps) {
  const t = await getTranslations("dashActivity");

  return (
    <DashboardSection title={t("panelHeading")} description={t("panelDescription")}>
      {entries.length === 0 ? (
        <p className="text-muted-foreground">{t("panelEmpty")}</p>
      ) : (
        <ActivityList entries={entries} />
      )}
    </DashboardSection>
  );
}
