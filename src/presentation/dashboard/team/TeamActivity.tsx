import { History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { roleChangeKind } from "@/src/domain/entities/RoleChange";
import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";
import { DataTable } from "@/src/presentation/design-system";

type TeamActivityProps = {
  /** Recent `user.roleChanged` entries from the activity log, newest first. */
  changes: ActivityEntryWire[];
};

/**
 * The audit trail for dashboard access: who changed whose role, and when.
 *
 * The entries now come from the one activity log rather than a role-only table,
 * but this panel stays: the team page should answer "who has held access" without
 * sending someone to a general log and asking them to filter it. It renders the
 * role-change slice with the role vocabulary ("gave admin access", "took
 * ownership"), which the generic list can't assume.
 *
 * Read-only and append-only — there is deliberately nothing here to edit or clear,
 * since a record an admin can quietly tidy up isn't one. Names come from the entry
 * rather than from the current team, so history stays truthful about people who
 * have since been renamed or removed.
 */
export function TeamActivity({ changes }: TeamActivityProps) {
  const t = useTranslations("dashTeam");
  const locale = useLocale();

  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-body-strong text-foreground">{t("activityHeading")}</h2>
        <p className="text-body-small text-muted-foreground">{t("activityDescription")}</p>
      </div>

      {changes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card-lg bg-surface-sunken/50 px-5 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"><History size={18} aria-hidden="true" /></span>
          <p className="text-body-small text-muted-foreground">{t("activityEmpty")}</p>
        </div>
      ) : (
        // The frame is the same card the admin tables sit in; the rows inside are
        // an ordered list, not a table — a log entry is one sentence, not columns.
        <DataTable>
          <ol className="divide-y divide-border">
            {changes.map((change) => (
              <li
                key={change.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 bg-background px-4 py-3"
              >
                <span className="text-body-small text-foreground">
                  {t(
                    `activity.${roleChangeKind({
                      userId: change.entityId,
                      actorId: change.actorId,
                      changes: change.changes,
                    })}`,
                    {
                      // The entry snapshots the name; the id is the fallback for a
                      // row written before labels existed.
                      user: change.entityLabel ?? change.entityId,
                      actor: change.actorName,
                    },
                  )}
                  {/* The name alone doesn't identify anyone until they've completed
                      their profile — everyone granted access before their first
                      sign-in carries the same placeholder. The id is their phone,
                      which does identify them. */}
                  <span dir="ltr" className="ms-2 text-body-caption text-muted-foreground">
                    {change.entityId}
                  </span>
                </span>
                <time dateTime={change.at} className="text-body-caption text-muted-foreground">
                  {formatRelativeTime(change.at, locale)}
                </time>
              </li>
            ))}
          </ol>
        </DataTable>
      )}
    </section>
  );
}
