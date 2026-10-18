import * as React from "react";

import { cn } from "@/src/lib/utils";

import { SpinnerLabel } from "../Spinner/SpinnerLabel";

export type LoadingRegionProps = React.HTMLAttributes<HTMLDivElement> & {
  /** What is loading, for screen readers ("Loading orders"). Defaults to the localized "Loading…". */
  label?: string;
};

/**
 * The container a page-level skeleton sits in (a route's `loading.tsx`).
 *
 * `<Skeleton>` blocks are `aria-hidden`, so on their own a screen reader hears
 * nothing while the page loads. This adds the one announcement — a polite
 * `role="status"` with a visually hidden "Loading…" — and marks the region busy.
 * Layout is the caller's: pass the same wrapper classes the real page uses, so
 * nothing moves when the content replaces the placeholder.
 */
export function LoadingRegion({ label, className, children, ...props }: LoadingRegionProps) {
  return (
    <div aria-busy className={cn(className)} {...props}>
      <div role="status" className="sr-only">
        <SpinnerLabel label={label} />
      </div>
      {children}
    </div>
  );
}
