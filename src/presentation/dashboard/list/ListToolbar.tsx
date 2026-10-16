import { cn } from "@/src/lib/utils";

import type { ReactNode } from "react";

type ListToolbarProps = {
  /** The search box — first in reading order, and full-width on a narrow viewport. */
  search?: ReactNode;
  /** Filter controls, laid out after the search and wrapping onto their own line when tight. */
  filters?: ReactNode;
  className?: string;
};

/**
 * Layout for the controls above an admin table. Presentational and server-
 * rendered — the interactive parts are the client components it's handed, so a
 * screen can keep its toolbar in the server tree and only ship the controls.
 */
export function ListToolbar({ search, filters, className }: ListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 [--radius-button:var(--radius-card-md)] [--radius-input:var(--radius-card-md)] 2xl:flex-row 2xl:items-center",
        className,
      )}
    >
      {search}
      {filters ? <div className="flex flex-wrap items-center gap-1.5 2xl:ms-auto">{filters}</div> : null}
    </div>
  );
}
