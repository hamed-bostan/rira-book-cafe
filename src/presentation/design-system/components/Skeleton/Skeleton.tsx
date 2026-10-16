import * as React from "react";

import { cn } from "@/src/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * A placeholder block standing in for content that hasn't arrived — a lazily
 * loaded map, an image still resolving.
 *
 * Always `aria-hidden`: a skeleton conveys nothing to a screen reader, which
 * announces the real content once it lands. Where the wait itself needs
 * announcing, put the live region on the container.
 *
 * It carries no size or radius of its own — those belong to the slot it fills,
 * so callers set them through `className` (`h-full w-full`, `size-12`,
 * `rounded-full`, …).
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden
    // The pulse loops for as long as the wait lasts, so it stills under reduced
    // motion; the block itself stays, and still marks the space as pending.
    className={cn("animate-pulse motion-reduce:animate-none bg-muted-strong", className)}
    {...props}
  />
));

Skeleton.displayName = "Skeleton";
