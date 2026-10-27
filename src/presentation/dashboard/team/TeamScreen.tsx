import { useTranslations } from "next-intl";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";

import { GrantAccessForm } from "./GrantAccessForm";
import { TeamActivity } from "./TeamActivity";
import { TeamMembers } from "./TeamMembers";

type TeamScreenProps = {
  /** Everyone who can reach the dashboard, fetched over the BFF during server render. */
  members: TeamMember[];
  /** Recent access changes from the activity log, newest first. */
  changes: ActivityEntryWire[];
};

/**
 * Who can reach the dashboard: add someone by phone and role, the members with
 * their roles and what can be done about each, and the history of every change.
 * Presentational — the page fetches over the REST API (BFF) during server render;
 * every change `router.refresh()`es, so the server stays the single source of
 * truth and this screen holds no data state.
 */
export function TeamScreen({ members, changes }: TeamScreenProps) {
  const t = useTranslations("dashTeam");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {t("summary", { count: members.length })}
        </p>
      </div>

      <GrantAccessForm memberIds={members.map((member) => member.id)} />

      <TeamMembers members={members} />

      <TeamActivity changes={changes} viewerId={members.find((member) => member.isSelf)?.id} />
    </div>
  );
}
