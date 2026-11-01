import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";

import { PAGE_CARD } from "../pageStyles";

import { PeriodPickerSkeleton } from "./PeriodPickerSkeleton";

/** Placeholder for `StatementHeader`: the way back, title and subtitle, then the period picker card. */
export function StatementHeaderSkeleton() {
  return (
    <>
      <DashboardPageHeaderSkeleton actions={0} />
      <div className={`${PAGE_CARD} px-5 py-4`}>
        <PeriodPickerSkeleton />
      </div>
    </>
  );
}
