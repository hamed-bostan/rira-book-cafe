import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import type { ReactNode } from "react";

type OverviewPanelProps = {
  /** Unique per page — names the section for assistive tech. */
  id: string;
  title: string;
  /** The count beside the title ("Order queue 2"), already formatted for the locale. */
  count?: string;
  /** The link at the header's end ("View all"). */
  action?: { href: string; label: string };
  /** Rows, each drawing its own top border (see `OverviewPanelRow`). */
  children: ReactNode;
  className?: string;
};

/**
 * A titled list card on the overview: header with an optional count and link, then
 * rows separated by hairlines that run edge to edge.
 */
export function OverviewPanel({ id, title, count, action, children, className }: OverviewPanelProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn("min-w-0 rounded-card-lg border border-border bg-background shadow-xs", className)}
    >
      <div className="flex items-center gap-2 px-5 py-4">
        <h2 id={id} className="text-body-strong text-foreground">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-badge-md bg-muted px-1.5 text-body-caption font-semibold text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
        {action ? (
          <Link
            href={action.href}
            // 44px tall to the touch on a phone, without moving the header's text.
            className={cn(
              "-my-3 ms-auto py-3 text-body-default font-medium whitespace-nowrap text-primary transition-colors hover:text-primary-hover sm:my-0 sm:py-0 sm:text-body-small",
              focusRing,
            )}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** One row of an overview panel: a lead column, the body, and an optional trailing action. */
export function OverviewPanelRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-5 py-3">{children}</div>;
}
