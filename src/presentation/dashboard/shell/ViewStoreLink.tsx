"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type ViewStoreLinkProps = {
  /** Icon-only for the collapsed rail. */
  collapsed?: boolean;
  /** Called after the link is chosen — the drawer uses it to close itself. */
  onNavigate?: () => void;
};

/** Escape hatch back to the storefront, pinned under the user card. */
export function ViewStoreLink({ collapsed = false, onNavigate }: ViewStoreLinkProps) {
  const t = useTranslations("dashboard");
  const label = t("viewStore");

  return (
    <div className="border-t border-border p-3">
      <Link
        href="/"
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        // Drawn like a nav row, so it reads as one more place to go.
        className={cn(
          "flex h-11 items-center gap-3 rounded-button text-body-default font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground sm:h-10 sm:text-body-small [&>svg]:text-muted-foreground",
          focusRing,
          collapsed ? "justify-center px-0" : "px-3",
        )}
      >
        <Icon icon={ExternalLink} size="md" className="sm:size-5" />
        <span className={cn(collapsed && "sr-only")}>{label}</span>
      </Link>
    </div>
  );
}
