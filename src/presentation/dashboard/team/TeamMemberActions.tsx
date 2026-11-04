"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import { Link } from "@/src/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { RemoveAccessDialog } from "./RemoveAccessDialog";
import { isolatedName } from "./teamDisplay";
import { TransferOwnershipDialog, type TransferIntent } from "./TransferOwnershipDialog";

import type { RoleOption } from "./roleDisplay";

type TeamMemberActionsProps = {
  member: TeamMember;
  /** The member's name as the row shows it. */
  name: string;
  /** Whether someone owns the cafe — decides what making yourself owner means. */
  hasOwner: boolean;
  /** The roles a change can give, named for this reader. */
  roleOptions: readonly RoleOption[];
};

type MemberDialog = "role" | "owner" | "remove";

/**
 * A member's commands behind "⋯": their sessions (a page of its own), then
 * Change role, Make owner and Remove access, each through a dialog. Only
 * what the server would allow is offered — never on your own row or the owner's,
 * and a role can't be changed for access that lives in the server config.
 */
export function TeamMemberActions({ member, name, hasOwner, roleOptions }: TeamMemberActionsProps) {
  const t = useTranslations("dashTeam");
  const [dialog, setDialog] = React.useState<MemberDialog | null>(null);
  // Bumped on every open, so each dialog starts afresh — no stale choice or error.
  const [opened, setOpened] = React.useState(0);

  const role = member.role === "owner" ? null : member.role;
  const canChangeRole = role !== null && !member.isSelf && !member.breakGlass;
  const canRemove = member.revokeBlocked === null;
  // Making yourself owner means claiming a vacant seat or, with break-glass
  // access, taking it off a sitting owner — each with its own warning.
  const intent: TransferIntent = !member.isSelf ? "transfer" : hasOwner ? "takeOver" : "claim";

  function open(next: MemberDialog): void {
    setOpened((count) => count + 1);
    setDialog(next);
  }

  const onOpenChange = (next: boolean): void => {
    if (!next) setDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger appearance="secondary" aria-label={t("moreActionsAria", { name })}>
          <Icon icon={MoreHorizontal} size="icon-md" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          {/* Every member has sessions to look at, so the menu is never empty. */}
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/team/${encodeURIComponent(member.id)}`}>{t("security.menu")}</Link>
          </DropdownMenuItem>
          {canChangeRole ? (
            <DropdownMenuItem onSelect={() => open("role")}>{t("changeRole.menu")}</DropdownMenuItem>
          ) : null}
          {member.transferable ? (
            <DropdownMenuItem onSelect={() => open("owner")}>{t(`ownership.${intent}.menu`)}</DropdownMenuItem>
          ) : null}
          {canRemove ? (
            <DropdownMenuItem destructive onSelect={() => open("remove")}>
              {t("remove.menu")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canChangeRole ? (
        <ChangeRoleDialog
          key={`role-${opened}`}
          open={dialog === "role"}
          onOpenChange={onOpenChange}
          id={member.id}
          name={isolatedName(name)}
          role={role}
          roleOptions={roleOptions}
        />
      ) : null}
      {member.transferable ? (
        <TransferOwnershipDialog
          key={`owner-${opened}`}
          open={dialog === "owner"}
          onOpenChange={onOpenChange}
          id={member.id}
          name={isolatedName(name)}
          intent={intent}
        />
      ) : null}
      {canRemove ? (
        <RemoveAccessDialog
          key={`remove-${opened}`}
          open={dialog === "remove"}
          onOpenChange={onOpenChange}
          id={member.id}
          name={isolatedName(name)}
        />
      ) : null}
    </>
  );
}
