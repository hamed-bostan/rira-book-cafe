import { DashboardFieldSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The settings cards in their two columns — profile and receipt, hours and tables — by how many fields each draws. */
const COLUMNS = [
  [5, 2],
  [7, 3],
] as const;

export default function DashboardSettingsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40 rounded-pill" />
        <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {COLUMNS.map((cards, column) => (
          <div key={column} className="flex flex-col gap-6">
            {cards.map((fields, card) => (
              <div key={card} className="rounded-card-lg border border-border bg-background shadow-xs">
                <div className="flex flex-col gap-1.5 border-b border-border px-5 py-4">
                  <Skeleton className="h-5 w-36 rounded-pill" />
                  <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
                </div>
                <div className="flex flex-col gap-4 p-5">
                  {Array.from({ length: fields }, (_, index) => (
                    <DashboardFieldSkeleton key={index} />
                  ))}
                  <Skeleton className="h-11 w-24 rounded-button sm:h-9" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
