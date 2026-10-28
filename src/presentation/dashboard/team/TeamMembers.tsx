import { useTranslations } from "next-intl";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import { formatPhone } from "@/src/lib/formatPhone";
import { cn } from "@/src/lib/utils";
import { Avatar } from "@/src/presentation/design-system/components/Avatar/Avatar";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

import { teamMemberInitials, teamMemberName } from "./teamDisplay";
import { TeamMemberActions } from "./TeamMemberActions";

type TeamMembersProps = {
  /** Everyone who can reach the dashboard, in the order the API returned them. */
  members: TeamMember[];
};

/** Warmer as the role gets more powerful — the owner stands out, support reads as neutral. */
const ROLE_VARIANT: Record<TeamMember["role"], NonNullable<BadgeProps["variant"]>> = {
  owner: "warning",
  admin: "success",
  staff: "info",
  support: "neutral",
};

/** Member · Access · ⋯ from `md`; below it the role drops under the name, in line with it. */
const COLUMNS = "md:grid-cols-[minmax(0,1fr)_10rem_2.5rem]";

/**
 * Everyone with dashboard access: who they are and their number, their role (and
 * whether it's set in the server config), and what can be done about it.
 */
export function TeamMembers({ members }: TeamMembersProps) {
  const t = useTranslations("dashTeam");
  const hasOwner = members.some((member) => member.role === "owner");

  return (
    <section
      aria-labelledby="team-members-heading"
      className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <h2 id="team-members-heading" className="text-body-strong text-foreground">
          {t("membersHeading")}
        </h2>
        <Badge variant="neutral" appearance="outline" size="compact" className="tabular-nums">
          {members.length}
        </Badge>
      </div>
      <div
        aria-hidden
        className={cn(
          "hidden h-10 items-center gap-x-4 border-b border-border bg-muted px-5 text-body-caption font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase md:grid",
          COLUMNS,
        )}
      >
        <span>{t("colMember")}</span>
        <span>{t("colAccess")}</span>
        <span />
      </div>
      <ul>
        {members.map((member, index) => {
          const name = teamMemberName(member.name, member.phone);
          const phone = formatPhone(member.phone);
          return (
            <li
              key={member.id}
              aria-label={name}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3",
                COLUMNS,
                index > 0 && "border-t border-border",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  // Its own initials, at body size and bold: the avatar's default type is a fixed 14px.
                  fallback={
                    <span aria-hidden className="text-body-default font-bold sm:text-body-small">
                      {teamMemberInitials(name, member.phone)}
                    </span>
                  }
                  className="size-10"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-default [overflow-wrap:anywhere] sm:text-body-small">
                    <span className="font-semibold text-foreground">{name}</span>
                    {member.isSelf ? <span className="ms-1 text-muted-foreground">{t("youSuffix")}</span> : null}
                  </span>
                  {name !== phone ? (
                    <span
                      dir="ltr"
                      className="self-start text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption"
                    >
                      <span className="sr-only">{t("colPhone")}: </span>
                      {phone}
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Under the name until `md`, indented to line up with it; its own column after. */}
              <div className="order-1 col-span-full flex flex-col items-start gap-1 ps-13 md:order-none md:col-span-1 md:ps-0">
                <Badge variant={ROLE_VARIANT[member.role]} appearance="outline" size="compact" dot>
                  {t(`role.${member.role}`)}
                </Badge>
                {member.breakGlass ? (
                  <span className="text-body-small text-muted-foreground sm:text-body-caption">
                    {t("managedInEnv")}
                  </span>
                ) : null}
              </div>
              <div className="flex justify-end">
                <TeamMemberActions member={member} name={name} hasOwner={hasOwner} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
