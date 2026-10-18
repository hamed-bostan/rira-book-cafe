import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { Icon } from "../Icon";

import type { LucideIcon } from "lucide-react";

const emptyStateVariants = cva(
  [
    "flex flex-col items-center text-center",
    // Eases in rather than snapping, so an empty result reads as an answer, not
    // a glitch. The rise is motion-safe only; the fade stays (see shared/motion).
    "duration-300 animate-in fade-in-0 motion-safe:slide-in-from-bottom-2",
  ],
  {
    variants: {
      /**
       * `section` sits inside a list, table card or panel. `page` is the whole
       * screen's answer — a 404, a failed load — and carries a page-level heading.
       */
      size: {
        section: "gap-1 px-6 py-16",
        page: "gap-2 px-6 py-20",
      },
    },
    defaultVariants: { size: "section" },
  },
);

const ICON_TONE = {
  neutral: "bg-surface-sunken text-muted-foreground",
  error: "bg-error text-error-foreground",
} as const;

export type EmptyStateProps = {
  /** A lucide glyph, drawn in a tinted circle. Decorative — the title carries the meaning. */
  icon?: LucideIcon;
  /**
   * Artwork in place of the icon. Must be decorative (`alt=""` on an
   * `<Image>`): the title already says it, and a described image would make a
   * screen reader announce the same thing twice.
   */
  illustration?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** The way out — usually a `<Button asChild>` wrapping a link, or a retry button. */
  action?: React.ReactNode;
  /** `error` tints the icon for a failure (a load that broke) rather than an absence. */
  tone?: keyof typeof ICON_TONE;
  size?: "section" | "page";
  /**
   * The title's element. Defaults to `h1` for a `page` (it *is* the page) and
   * `p` for a `section`, where the surrounding screen already has its heading.
   */
  titleAs?: "h1" | "h2" | "h3" | "p";
  className?: string;
};

/**
 * The "nothing here" block: an icon (or illustration), a message saying why, and
 * optionally a way out. One component for every empty list, 404 and failed load,
 * so they read as the same family instead of drifting apart one screen at a time.
 */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  tone = "neutral",
  size = "section",
  titleAs,
  className,
}: EmptyStateProps) {
  const Title = titleAs ?? (size === "page" ? "h1" : "p");

  return (
    <div className={cn(emptyStateVariants({ size }), className)}>
      {illustration ??
        (icon ? (
          <div className={cn("mb-4 flex size-14 items-center justify-center rounded-full", ICON_TONE[tone])}>
            <Icon icon={icon} size="lg" />
          </div>
        ) : null)}
      <Title className={cn("text-foreground", size === "page" ? "text-heading-section" : "text-body-strong")}>
        {title}
      </Title>
      {description ? (
        <p className={cn("max-w-md text-muted-foreground", size === "page" ? "text-body-default" : "text-body-small")}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
