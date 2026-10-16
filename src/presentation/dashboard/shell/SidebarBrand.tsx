"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system";

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
        "flex items-center gap-2 py-5 text-heading-subsection text-foreground md:h-24 md:py-0 xl:h-16",
        focusRing,
        collapsed ? "justify-center px-0" : "px-5",
      )}
    >
      <BrandMark />
      <span className={cn(collapsed && "sr-only")}>
        {brand} <span className="text-primary">{t("admin")}</span>
      </span>
    </Link>
  );
}
