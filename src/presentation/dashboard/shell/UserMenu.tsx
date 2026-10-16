"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { UserRole } from "@/src/domain/entities/User";
import { cn } from "@/src/lib/utils";
import { logout } from "@/src/presentation/auth/actions";
import {
  Avatar,
  Badge,
  ConfirmSheet,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  focusRing,
} from "@/src/presentation/design-system";

import type { DashboardViewer } from "./viewer";

/** Mirrors `TeamTable`'s role tones — same role, same colour, wherever it's shown. */
const ROLE_BADGE_VARIANT: Record<UserRole, "warning" | "success" | "info" | "neutral"> = {
  owner: "warning",
  admin: "success",
  staff: "info",
  support: "neutral",
  customer: "neutral",
};

type UserMenuProps = {
  viewer: DashboardViewer;
};

/**
 * The signed-in account, top-right of the dashboard chrome: an avatar trigger
 * opening a summary of who's signed in, and sign out behind a confirmation —
 * leaving the dashboard mid-task on a stray click is the one mistake here worth
 * guarding against.
 */
export function UserMenu({ viewer }: UserMenuProps) {
  const t = useTranslations("dashboard");
  const tTeam = useTranslations("dashTeam");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("account")}
            className={cn("flex size-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80", focusRing)}
          >
            <Avatar name={viewer.name} className="size-12 dashboard-phone:size-10 xl:size-9">
              {viewer.imageUrl && (
                <Image src={viewer.imageUrl} alt="" width={36} height={36} className="size-full object-cover" />
              )}
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="min-w-56">
          <div className="flex flex-col items-start gap-1 px-2 py-1.5">
            <span className="max-w-full truncate text-body-small text-foreground">{viewer.name}</span>
            {viewer.email && (
              <span className="max-w-full truncate text-body-small-bold text-muted-foreground">{viewer.email}</span>
            )}
            <Badge variant={ROLE_BADGE_VARIANT[viewer.role]} className="mt-1">
              {tTeam(`role.${viewer.role}`)}
            </Badge>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            <Icon icon={LogOut} size="sm" />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("signOutTitle")}
        message={t("signOutMessage")}
        confirmLabel={t("signOut")}
        onConfirm={handleLogout}
      />
    </>
  );
}
