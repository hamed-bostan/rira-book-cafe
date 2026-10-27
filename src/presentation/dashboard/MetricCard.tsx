import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import type { LucideIcon } from "lucide-react";

/** The colour a hint takes when it says something: a change for the better, one to watch, one to act on. */
export type MetricCardTone = "success" | "warning" | "danger";

type MetricCardProps = {
  label: string;
  icon: LucideIcon;
  /** The figure, already formatted for the locale. */
  value: string;
  /** A unit set beside the figure in a quieter weight ("Toman"). */
  unit?: string;
  /** One line of context under the figure. */
  hint?: string;
  /** Colours the hint — a rise or fall against the last period, or something to deal with. */
  hintTone?: MetricCardTone;
  /** The hint needs acting on: a dot beside it, so it doesn't rely on colour alone. */
  hintDot?: boolean;
  /** The list this figure filters to. Omitted for a figure that filters nothing. */
  href?: string;
  /** The list on screen is this card's filter. */
  selected?: boolean;
  className?: string;
};

const HINT_TONE: Record<MetricCardTone, string> = {
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  danger: "text-error-foreground",
};

/**
 * One figure in the row of cards across the top of a dashboard page: what it
 * measures and an icon, the figure with its unit, and a line of context under it.
 * A card that stands for a filter ("Running low", "Owed") is a link to it,
 * outlined while it's applied.
 */
export function MetricCard({
  label,
  icon,
  value,
  unit,
  hint,
  hintTone,
  hintDot = false,
  href,
  selected = false,
  className,
}: MetricCardProps) {
  const frame = cn(
    "flex min-w-0 flex-col justify-between gap-4 rounded-card-lg border bg-background px-5 py-4 text-foreground shadow-xs",
    selected ? "border-accent-border" : "border-border",
    className,
  );

  const content = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-body-default font-medium text-foreground/80 sm:text-body-small sm:leading-5">
          {label}
        </span>
        <Icon icon={icon} size="sm" className="shrink-0 text-muted-foreground sm:size-4" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-heading-subsection leading-7 tracking-tight tabular-nums sm:text-heading-section sm:leading-8">
            {value}
          </span>
          {unit ? (
            <span className="text-body-default font-medium text-muted-foreground sm:text-body-small">{unit}</span>
          ) : null}
        </span>
        {hint ? (
          <span
            className={cn(
              "flex items-center gap-1.5 text-body-small leading-5 sm:text-body-caption sm:leading-4",
              hintTone ? cn("font-medium", HINT_TONE[hintTone]) : "text-muted-foreground",
            )}
          >
            {hintDot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
            {hint}
          </span>
        ) : null}
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
