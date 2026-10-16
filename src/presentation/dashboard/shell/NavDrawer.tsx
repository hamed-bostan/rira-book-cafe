"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, VisuallyHidden } from "radix-ui";

import type { Permission } from "@/src/domain/entities/Permission";
import { cn } from "@/src/lib/utils";
import { Button, Icon } from "@/src/presentation/design-system";

import { DashboardNav } from "./DashboardNav";
import { SidebarBrand } from "./SidebarBrand";
import { ViewStoreLink } from "./ViewStoreLink";

type NavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: readonly Permission[];
};

/**
 * The dashboard's nav, drawer-style, for viewports too narrow for a persistent
 * sidebar (below `lg`). Same content as the desktop rail — brand, grouped nav,
 * "View store" — so there is never a second, drifting copy of the section
 * list to keep in sync. The profile card is desktop-rail only; the drawer
 * skips it to keep the mobile nav compact.
 */
export function NavDrawer({ open, onOpenChange, permissions }: NavDrawerProps) {
  const t = useTranslations("dashboard");
  const tDs = useTranslations("ds");

  function close(): void {
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/40",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />

        <Dialog.Content
          className={cn(
            "fixed inset-y-0 start-0 z-50 flex w-72 max-w-[80vw] flex-col border-e border-border bg-background shadow-lg",
            "focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "motion-safe:data-[state=open]:slide-in-from-left motion-safe:data-[state=closed]:slide-out-to-left",
            "rtl:motion-safe:data-[state=open]:slide-in-from-right rtl:motion-safe:data-[state=closed]:slide-out-to-right",
            "motion-reduce:data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{t("navMenuTitle")}</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="flex items-center justify-between">
            <SidebarBrand />
            <Dialog.Close asChild>
              <Button variant="ghost" iconOnly size="sm" aria-label={tDs("close")} className="me-3">
                <Icon icon={X} size="sm" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <DashboardNav permissions={permissions} onNavigate={close} />
          </div>

          <ViewStoreLink onNavigate={close} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
