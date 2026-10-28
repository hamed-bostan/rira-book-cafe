import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import type { LucideIcon } from "lucide-react";

type OverviewStatProps = {
  label: string;
  icon: LucideIcon;
  /** The figure, already formatted for the locale. */
  value: string;
  /** A unit set beside the figure in a quieter weight ("Toman"). */
  unit?: string;
  /** One line of context under the figure. */
  hint: string;
  /** The hint needs someone's attention (orders waiting too long): amber, with a dot. */
  alert?: boolean;
  href: string;
  className?: string;
};

/**
 * One headline number on the overview, linking to where it's worked on. The
 * figure carries the card; colour is kept for the one thing that needs acting on,
 * the alert hint — the dot beside it means it doesn't rely on colour alone.
 */
export function OverviewStat({ label, icon, value, unit, hint, alert = false, href, className }: OverviewStatProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col justify-between gap-4 rounded-card-lg border border-border bg-background px-5 py-4 text-foreground shadow-xs transition-colors hover:border-border-strong",
        focusRing,
        className,
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-body-default font-medium sm:text-body-small">{label}</span>
        <Icon icon={icon} size="icon-md" className="text-muted-foreground" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-heading-subsection tracking-tight tabular-nums sm:text-heading-section">{value}</span>
          {unit ? (
            <span className="text-body-default font-medium text-muted-foreground sm:text-body-small">{unit}</span>
          ) : null}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-body-small sm:text-body-caption",
            alert ? "font-semibold text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {alert ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
          {hint}
        </span>
      </span>
    </Link>
  );
}
