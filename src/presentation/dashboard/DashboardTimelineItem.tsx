import { cn } from "@/src/lib/utils";

import type { ReactNode } from "react";

type DashboardTimelineItemProps = {
  /** The latest step, whichever end of the list that is: its dot takes the primary colour. */
  current: boolean;
  /** The list's final row, where the connecting line stops. */
  last: boolean;
  children: ReactNode;
};

/** One step of a history, on a dotted line down the `<ol>` it sits in. */
export function DashboardTimelineItem({ current, last, children }: DashboardTimelineItemProps) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="flex w-2 flex-none flex-col items-center">
        <span className={cn("mt-1.5 size-2 flex-none rounded-full", current ? "bg-primary" : "bg-border-strong")} />
        <span className={cn("mt-1 w-px flex-1", !last && "bg-border")} />
      </span>
      <div className={cn("flex min-w-0 flex-1 flex-col", !last && "pb-4")}>{children}</div>
    </li>
  );
}
