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
    <Link
      href="/"
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center justify-center gap-2 border-t border-border py-6 text-body-small-emphasis text-muted-foreground transition-colors hover:text-foreground",
        focusRing,
        collapsed ? "justify-center px-0" : "px-5",
      )}
    >
      <Icon icon={ExternalLink} size="sm" />
      <span className={cn(collapsed && "sr-only")}>{label}</span>
    </Link>
  );
}
