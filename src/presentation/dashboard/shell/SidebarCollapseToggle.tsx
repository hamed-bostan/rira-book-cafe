"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/src/lib/utils";
import { Button, Icon } from "@/src/presentation/design-system";

type SidebarCollapseToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
};

/** Switches the `xl`+ rail between its full, labelled width and the icon-only rail that `lg`–`xl` always uses. */
export function SidebarCollapseToggle({ collapsed, onToggle, className }: SidebarCollapseToggleProps) {
  const t = useTranslations("dashboard");

  return (
    <Button
      variant="ghost"
      iconOnly
      size="sm"
      aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
      onClick={onToggle}
      className={cn("text-icon-muted", className)}
    >
      <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size="sm" className="rtl:-scale-x-100" />
    </Button>
  );
}
