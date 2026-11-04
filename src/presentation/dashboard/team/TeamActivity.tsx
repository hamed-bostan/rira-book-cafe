import { useLocale, useTranslations } from "next-intl";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { roleChangeKind, roleMove } from "@/src/domain/entities/RoleChange";
import type { UserRole } from "@/src/domain/entities/User";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";
import { DashboardEmptyState } from "@/src/presentation/dashboard/DashboardEmptyState";
import { TEXT_ACTION } from "@/src/presentation/dashboard/fieldStyles";

import { roleDisplayName, type RoleNames } from "./roleDisplay";
import { isolatedName, teamMemberName } from "./teamDisplay";

type TeamActivityProps = {
  /** Recent `user.roleChanged` entries from the activity log, newest first. */
  changes: ActivityEntryWire[];
  /** The signed-in owner, who reads as "You" in the sentences. */
  viewerId: string | undefined;
  /** Custom roles' names, for changes to or from one. */
  roleNames: RoleNames;
};

/**
 * The audit trail for dashboard access, one sentence per change: "You gave Kian
 * Support access", "You changed Niloofar from Support to Staff".
 *
 * The entries come from the one activity log, but this card stays: the team page
 * should answer "who has held access" without sending someone to a general log
 * and asking them to filter it. Read-only and append-only — a record an admin
 * can quietly tidy up isn't one. Names come from the entry rather than the
 * current team, so history stays truthful about people since renamed or removed.
 */
export function TeamActivity({ changes, viewerId, roleNames }: TeamActivityProps) {
  const t = useTranslations("dashTeam");
  const locale = useLocale();
  const roleLabel = (role: UserRole | undefined): string =>
    roleDisplayName(role ?? "customer", {
      builtIn: (builtIn) => t(`role.${builtIn}`),
      names: roleNames,
      locale,
      fallback: t("customRoleFallback"),
    });

  function sentence(change: ActivityEntryWire): string {
    const kind = roleChangeKind({ userId: change.entityId, actorId: change.actorId, changes: change.changes });
    const move = roleMove(change.changes);
    const isViewer = change.entityId === viewerId;
    // The entry snapshots the name; the id — their phone — stands in for a
    // placeholder or a row written before labels existed. Both go into the
    // sentence isolated, so a number keeps its order in a Persian line.
    const person = isolatedName(teamMemberName(change.entityLabel, change.entityId));
    const user = isViewer ? t("activity.youObject") : person;
    const actor = change.actorId === viewerId ? t("activity.you") : isolatedName(change.actorName);

    switch (kind) {
      case "granted":
        return t("activity.granted", { actor, user, role: roleLabel(move?.toRole) });
      case "changed":
        return t("activity.changed", {
          actor,
          user,
          from: roleLabel(move?.fromRole),
          to: roleLabel(move?.toRole),
        });
      case "ownershipClaimed":
      case "steppedDown":
        // The person is the subject of these sentences, so "You", not "you".
        return t(`activity.${kind}`, { user: isViewer ? t("activity.you") : person });
      default:
        return t(`activity.${kind}`, { actor, user });
    }
  }

  return (
    <section
      aria-labelledby="access-history-heading"
      className="flex min-w-0 flex-col gap-2 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="access-history-heading" className="text-body-strong text-foreground">
            {t("activityHeading")}
          </h2>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
            {t("activityDescription")}
          </p>
        </div>
        {/* The card shows the latest access changes; every team change — roles, settings,
            sign-outs, two-factor — is on the activity page, filtered to the team. */}
        <Link
          href="/dashboard/activity?entityType=user"
          className={cn(TEXT_ACTION, "text-primary hover:text-primary-hover")}
        >
          {t("activitySeeAll")}
        </Link>
      </div>

      {changes.length === 0 ? (
        <DashboardEmptyState title={t("activityEmpty")} body={t("activityEmptyBody")} className="py-8" />
      ) : (
        <ol>
          {changes.map((change, index) => (
            <li
              key={change.id}
              className={cn(
                "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3",
                index > 0 && "border-t border-border",
              )}
            >
              <span className="min-w-0 text-body-default text-pretty text-foreground sm:text-body-small">
                {sentence(change)}
              </span>
              <time
                dateTime={change.at}
                className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption"
              >
                {formatCafeDayShort(cafeDayOf(new Date(change.at)), locale)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
