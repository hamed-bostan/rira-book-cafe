import { useLocale, useTranslations } from "next-intl";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import { GRANTABLE_ROLES } from "@/src/domain/entities/User";
import type { ActivityEntryWire } from "@/src/presentation/dashboard/activity/activity-response-schema";
import { DashboardLinkTabs } from "@/src/presentation/dashboard/DashboardLinkTabs";

import { GrantAccessForm } from "./GrantAccessForm";
import { roleNamesOf, type RoleOption } from "./roleDisplay";
import { RolesPanel } from "./RolesPanel";
import { TeamActivity } from "./TeamActivity";
import { TeamMembers } from "./TeamMembers";
import { TeamSecuritySettings } from "./TeamSecuritySettings";

import type { RoleWire, TeamSettingsWire } from "./security-response-schema";

/** The team page's tabs, each its own URL (`?tab=`). */
export const TEAM_TABS = ["members", "roles", "security"] as const;

export type TeamTab = (typeof TEAM_TABS)[number];

type TeamScreenProps = {
  tab: TeamTab;
  /** Everyone who can reach the dashboard, fetched over the BFF during server render. */
  members: TeamMember[];
  /** The roles the owner manages — for the roles tab, and to name custom roles everywhere. */
  roles: RoleWire[];
  /** Recent access changes from the activity log, newest first (members tab). */
  changes: ActivityEntryWire[];
  /** The team's security settings (security tab). */
  settings: TeamSettingsWire | null;
};

/**
 * Who can reach the dashboard and what they may do, in three tabs: the members
 * (add someone, the list, the history of access), the roles (what each may do, and
 * the owner's own), and the team's security settings (how long the activity log
 * keeps entries). Presentational — the page fetches over the REST
 * API (BFF) during server render; every change `router.refresh()`es.
 */
export function TeamScreen({ tab, members, roles, changes, settings }: TeamScreenProps) {
  const t = useTranslations("dashTeam");
  const locale = useLocale();
  const roleNames = roleNamesOf(roles);
  // Built-in roles first, in their usual order and with their one-line summaries,
  // then the owner's own under their names.
  const roleOptions: RoleOption[] = [
    ...GRANTABLE_ROLES.map((role) => ({ value: role, label: t(`roleOption.${role}`) })),
    ...roles.flatMap((role) =>
      role.name && !role.builtIn ? [{ value: role.key, label: locale === "fa" ? role.name.fa : role.name.en }] : [],
    ),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {t("summary", { count: members.length })}
        </p>
      </div>

      <DashboardLinkTabs
        label={t("tabsLabel")}
        current={tab}
        tabs={TEAM_TABS.map((key) => ({
          key,
          label: t(`tab.${key}`),
          href: key === "members" ? "/dashboard/team" : `/dashboard/team?tab=${key}`,
        }))}
      />

      {tab === "members" ? (
        <>
          <GrantAccessForm memberIds={members.map((member) => member.id)} roleOptions={roleOptions} />
          <TeamMembers members={members} roleNames={roleNames} roleOptions={roleOptions} />
          <TeamActivity
            changes={changes}
            viewerId={members.find((member) => member.isSelf)?.id}
            roleNames={roleNames}
          />
        </>
      ) : null}
      {tab === "roles" ? <RolesPanel roles={roles} /> : null}
      {tab === "security" && settings ? <TeamSecuritySettings settings={settings} /> : null}
    </div>
  );
}
