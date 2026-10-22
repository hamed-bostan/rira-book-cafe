import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import type { LucideIcon } from "lucide-react";

type InventoryStatCardProps = {
  label: string;
  icon: LucideIcon;
  /** The figure, already formatted for the locale. */
  value: string;
  /** A unit set beside the figure in a quieter weight ("Toman"). */
  unit?: string;
  /** One line of context under the figure. */
  hint: string;
  /** The hint needs acting on: coloured, with a dot so it doesn't rely on colour alone. */
  alert?: "warning" | "danger";
  /** The list this figure filters to. Omitted for a figure that filters nothing (stock value). */
  href?: string;
  /** The list on screen is this card's filter. */
  selected?: boolean;
  className?: string;
};

const ALERT_TONE: Record<NonNullable<InventoryStatCardProps["alert"]>, string> = {
  warning: "text-warning-foreground",
  danger: "text-error-foreground",
};

/**
 * One of the figures across the top of Inventory. "Running low" and "Out of
 * stock" are also the quickest way to the rows behind them: the card is a link to
 * that filter, outlined while it's applied, and leads back to every item when
 * it's chosen again.
 */
export function InventoryStatCard({
  label,
  icon,
  value,
  unit,
  hint,
  alert,
  href,
  selected = false,
  className,
}: InventoryStatCardProps) {
  const frame = cn(
    "flex min-w-0 flex-col justify-between gap-4 rounded-card-lg border bg-background px-5 py-4 text-foreground shadow-xs",
    selected ? "border-accent-border" : "border-border",
    className,
  );

  const content = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-body-default font-medium text-foreground/80 sm:text-body-small">{label}</span>
        <Icon icon={icon} size="sm" className="text-muted-foreground sm:size-4" />
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
            alert ? cn("font-medium", ALERT_TONE[alert]) : "text-muted-foreground",
          )}
        >
          {alert ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
          {hint}
        </span>
      </span>
    </>
  );

  if (!href) return <div className={frame}>{content}</div>;

  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(frame, "transition-colors hover:border-border-strong", focusRing)}
    >
      {content}
    </Link>
  );
}
