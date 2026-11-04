import { useTranslations } from "next-intl";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import { DashboardBackLink } from "@/src/presentation/dashboard/DashboardBackLink";
import { SessionList } from "@/src/presentation/dashboard/security/SessionList";

import { isolatedName, teamMemberName } from "./teamDisplay";

import type { SessionWire } from "./security-response-schema";

type TeamMemberSecurityScreenProps = {
  member: TeamMember;
  sessions: SessionWire[];
};

/**
 * One team member's sign-in security, for the owner: where they're signed in, each
 * browser or all of them signable-out. Your own row shows the same.
 */
export function TeamMemberSecurityScreen({ member, sessions }: TeamMemberSecurityScreenProps) {
  const t = useTranslations("dashTeam");
  const name = teamMemberName(member.name, member.phone);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <DashboardBackLink href="/dashboard/team">{t("security.back")}</DashboardBackLink>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title [overflow-wrap:anywhere]">
            {t("security.title", { name: isolatedName(name) })}
          </h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
            {t("security.summary")}
          </p>
        </div>
      </div>

      <SessionList
        sessions={sessions}
        owner={member.isSelf ? { kind: "self" } : { kind: "member", id: member.id, name: isolatedName(name) }}
      />
    </div>
  );
}
