import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/src/presentation/design-system";

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
 * Sits below the form: the screen above is what the thing *is*, this is what has
 * been done to it.
 */
export async function ActivityPanel({ entries }: ActivityPanelProps) {
  const t = await getTranslations("dashActivity");

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-body-strong text-foreground">{t("panelHeading")}</h2>
        <p className="text-body-small text-muted-foreground">{t("panelDescription")}</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={History} title={t("panelEmpty")} className="rounded-card-lg border border-dashed border-border py-10" />
      ) : (
        <ActivityList entries={entries} showEntity={false} />
      )}
    </section>
  );
}
