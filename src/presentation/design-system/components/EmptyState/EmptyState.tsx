import * as React from "react";

import { cn } from "@/src/lib/utils";

export interface EmptyStateProps {
  /**
   * The illustration. Must be decorative (`alt=""` on an `<Image>`) — the title
   * below already carries the meaning, so a described image would only make a
   * screen reader announce the same thing twice.
   *
   * Passed as a node rather than a `src`, so each screen keeps its own artwork
   * dimensions and the design system stays clear of `next/image`.
   */
  illustration: React.ReactNode;
  title: string;
  description?: string;
  /**
   * The way out — usually a `<Button asChild>` wrapping a link. Rendered as the
   * last child of the column, so the caller can pin it to the bottom with
   * `mt-auto` (pair with `flex-1` on `className`) or push it down by a fixed step.
   */
  action?: React.ReactNode;
  /**
   * Lead with the message instead of the artwork. Off by default: the
   * illustration is what makes an empty screen read as intentional rather than
   * broken, so it normally comes first.
   */
  titleFirst?: boolean;
  /**
   * Vertical placement within the page — `flex-1`, `justify-center`, `pt-10`.
   * That belongs to the screen, not to this component.
   */
  className?: string;
}

/**
 * The "there's nothing here yet" screen: an illustration, a heading explaining
 * why, and optionally a way out.
 *
 * It exists to hold the *heading* still. Written by hand three times, the same
 * message had drifted into three different treatments — two sizes and two
 * colours — which is the kind of difference nobody notices while writing the
 * fourth one.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  titleFirst = false,
  className,
}: EmptyStateProps) {
  const heading = (
    <div className="flex flex-col items-center gap-2">
      <h2 className="text-heading-subsection text-foreground">{title}</h2>
      {description && <p className="text-body-strong text-muted-foreground">{description}</p>}
    </div>
  );

  return (
    <div className={cn("flex flex-col items-center gap-8 text-center", className)}>
      {titleFirst && heading}
      {illustration}
      {!titleFirst && heading}
      {action}
    </div>
  );
}
