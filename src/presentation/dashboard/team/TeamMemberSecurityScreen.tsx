import { useTranslations } from "next-intl";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import { DashboardBackLink } from "@/src/presentation/dashboard/DashboardBackLink";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { ROW_CAPTION } from "@/src/presentation/dashboard/pageStyles";
import { SessionList } from "@/src/presentation/dashboard/security/SessionList";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { ResetTwoFactorButton } from "./ResetTwoFactorButton";
import { isolatedName, teamMemberName } from "./teamDisplay";

import type { SessionWire } from "./security-response-schema";

type TeamMemberSecurityScreenProps = {
  member: TeamMember;
  sessions: SessionWire[];
};

/**
 * One team member's sign-in security, for the owner: whether they use an
 * authenticator app (and resetting it, for a lost phone), and where they're signed
 * in, each browser or all of them signable-out. Your own row shows the same, but
 * your own two-factor is managed from your security page.
 */
export function TeamMemberSecurityScreen({ member, sessions }: TeamMemberSecurityScreenProps) {
  const t = useTranslations("dashTeam");
  const name = teamMemberName(member.name, member.phone);
  const on = member.twoFactor !== "off";

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

      <DashboardSection
        title={t("security.twoFactorHeading")}
        aside={
          <Badge variant={member.twoFactor === "on" ? "success" : "neutral"} appearance="outline" size="compact" dot>
            {t(`security.twoFactorState.${member.twoFactor}`)}
          </Badge>
        }
      >
        {member.isSelf ? (
          <p className={ROW_CAPTION}>{t("security.ownTwoFactor")}</p>
        ) : on ? (
          <div className="flex flex-col gap-3">
            <p className={ROW_CAPTION}>{t("security.resetHint")}</p>
            <ResetTwoFactorButton id={member.id} name={isolatedName(name)} />
          </div>
        ) : (
          <p className={ROW_CAPTION}>{t("security.twoFactorOffHint")}</p>
        )}
      </DashboardSection>

      <SessionList
        sessions={sessions}
        owner={member.isSelf ? { kind: "self" } : { kind: "member", id: member.id, name: isolatedName(name) }}
      />
    </div>
  );
}
