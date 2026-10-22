"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { BrandMark } from "./BrandMark";

type SidebarBrandProps = {
  /** Icon-only mark for the collapsed rail — the wordmark has nowhere to go at 40px. */
  collapsed?: boolean;
};

/** The dashboard's brand link, shared by the desktop rail, the collapsed rail, and the mobile drawer. */
export function SidebarBrand({ collapsed = false }: SidebarBrandProps) {
  const t = useTranslations("dashboard");
  const brand = t("brand");

  return (
    <Link
      href="/dashboard"
      title={collapsed ? `${brand} ${t("admin")}` : undefined}
      className={cn(
        "flex h-16 min-w-0 items-center gap-2 text-body-lead tracking-tight whitespace-nowrap text-foreground",
        focusRing,
        collapsed ? "justify-center px-0" : "px-5",
      )}
    >
      <BrandMark className="h-8" />
      <span className={cn(collapsed && "sr-only")}>
        {brand} <span className="text-primary">{t("admin")}</span>
      </span>
    </Link>
  );
}
