"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { logout } from "@/src/presentation/auth/actions";
import { Avatar } from "@/src/presentation/design-system/components/Avatar/Avatar";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";

import { roleBadgeVariant, roleDisplayName } from "../team/roleDisplay";

import type { DashboardViewer } from "./viewer";

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
  const locale = useLocale();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // The server action redirects away; the transition stays pending until it has,
  // so the sheet stays up with a spinner instead of closing on a page that lingers.
  function handleLogout(): void {
    startTransition(() => logout());
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80",
              focusRing,
            )}
          >
            {/* The name ("Account menu") comes from hidden text rather than aria-label: the
                avatar's initials are decorative, and an aria-label that doesn't contain the
                visible text fails WCAG 2.5.3 (label in name). */}
            <span className="sr-only">{t("account")}</span>
            <span aria-hidden className="contents">
              <Avatar name={viewer.name} className="size-12 xl:size-9 dashboard-phone:size-10">
                {viewer.imageUrl && (
                  <Image src={viewer.imageUrl} alt="" width={36} height={36} className="size-full object-cover" />
                )}
              </Avatar>
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="min-w-56">
          <div className="flex flex-col items-start gap-1 px-2 py-1.5">
            <span className="max-w-full truncate text-body-small text-foreground">{viewer.name}</span>
            {viewer.email && (
              <span className="max-w-full truncate text-body-small-bold text-muted-foreground">{viewer.email}</span>
            )}
            <Badge variant={roleBadgeVariant(viewer.role)} className="mt-1">
              {roleDisplayName(viewer.role, {
                builtIn: (role) => tTeam(`role.${role}`),
                names: viewer.roleName ? { [viewer.role]: viewer.roleName } : {},
                locale,
                fallback: tTeam("customRoleFallback"),
              })}
            </Badge>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/dashboard/security">
              <Icon icon={ShieldCheck} size="sm" />
              {t("security")}
            </Link>
          </DropdownMenuItem>

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
        pending={pending}
        onConfirm={handleLogout}
      />
    </>
  );
}
