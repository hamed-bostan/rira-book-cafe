import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import type { UserRole } from "@/src/domain/entities/User";
import {
  Avatar,
  Badge,
  Button,
  Icon,
} from "@/src/presentation/design-system";

import { RevokeAdminButton } from "./RevokeAdminButton";
import { TransferOwnershipButton } from "./TransferOwnershipButton";

type TeamTableProps = {
  /** Everyone who can reach the dashboard, in the order the API returned them. */
  members: TeamMember[];
};

/**
 * Badge tone per role, warm as the role gets more powerful — owner stands out,
 * support reads as neutral. `customer` can't appear in this table (revoking access
 * removes the row) but the map is total so the type stays honest.
 */
const ROLE_BADGE_VARIANT: Record<UserRole, "warning" | "success" | "info" | "neutral"> = {
  owner: "warning",
  admin: "success",
  staff: "info",
  support: "neutral",
  customer: "neutral",
};

/** Responsive member directory with server-controlled permissions. */
export function TeamTable({ members }: TeamTableProps) {
  const t = useTranslations("dashTeam");
  // Taking ownership means three different things depending on the situation —
  // claiming a vacant seat, taking it off a sitting owner, or handing it over —
  // and each needs its own confirmation. These decide only which copy to show;
  // the server still decides what's permitted.
  const hasOwner = members.some((member) => member.role === "owner");

  return (
    <section aria-label={t("membersHeading")} className="overflow-hidden rounded-card-lg border border-border bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-body-strong text-foreground">{t("membersHeading")}</h2>
        <Badge variant="neutral">{members.length}</Badge>
      </div>
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_10rem_6rem] gap-4 bg-surface-sunken/60 px-5 py-3 text-body-small-strong text-muted-foreground md:grid">
        <span>{t("colMember")}</span><span>{t("colAccess")}</span><span className="text-end">{t("colActions")}</span>
      </div>
      <ul className="divide-y divide-border">
        {members.map((member) => (
          <li key={member.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_10rem_6rem] md:gap-4">
            <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
              <Avatar name={member.name} className="size-11" />
              <div className="min-w-0">
                <p className="text-body-small-emphasis text-foreground [overflow-wrap:anywhere]">
                  {member.name}
                  {member.isSelf && <span className="ms-1 text-body-small text-muted-foreground">{t("youSuffix")}</span>}
                </p>
                <p dir="ltr" className="mt-1 w-fit text-body-small text-muted-foreground [overflow-wrap:anywhere]">
                  <span className="sr-only">{t("colPhone")}: </span>{member.phone}
                </p>
              </div>
            </div>
            {/* The badge is the role and nothing else. Where the grant is stored
                is metadata about the row, so it sits underneath as a note —
                rendering "Server config" as a peer of "Admin" implied they were
                two different access levels, which they never were. */}
            <span className="flex min-w-0 flex-col items-start gap-1.5">
              <Badge variant={ROLE_BADGE_VARIANT[member.role]}>{t(`role.${member.role}`)}</Badge>
              {member.breakGlass && (
                <span className="text-body-caption text-muted-foreground">{t("managedInEnv")}</span>
              )}
            </span>
            <span className="flex justify-end gap-1">
              {member.transferable && (
                <TransferOwnershipButton
                  id={member.id}
                  name={member.name}
                  intent={
                    !member.isSelf ? "transfer" : hasOwner ? "takeOver" : "claim"
                  }
                />
              )}
              {member.revokeBlocked === null ? (
                <RevokeAdminButton id={member.id} name={member.name} />
              ) : (
                // Not rendered for your own row — nobody looks for a button to
                // remove themselves. For the others the button stays, disabled,
                // carrying the reason: a silently missing control just reads as
                // a bug.
                member.revokeBlocked !== "self" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconOnly
                    disabled
                    aria-label={t(`revokeBlocked.${member.revokeBlocked}`)}
                    title={t(`revokeBlocked.${member.revokeBlocked}`)}
                    className="size-11 sm:size-10"
                  >
                    <Icon icon={Trash2} size="sm" />
                  </Button>
                )
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
