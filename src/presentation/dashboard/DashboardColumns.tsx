import type { ReactNode } from "react";

type DashboardColumnsProps = {
  main: ReactNode;
  /** The narrow column; stacks under `main` until `lg`. */
  side: ReactNode;
};

/** A full page's body: what it's about in the wide column, its settings and history in the narrow one. */
export function DashboardColumns({ main, side }: DashboardColumnsProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <div className="flex min-w-0 flex-col gap-6">{side}</div>
    </div>
  );
}
