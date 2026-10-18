import { RecordRowSkeleton } from "./RecordRowSkeleton";

type RecordListSkeletonProps = {
  /** Rows to draw. */
  rows?: number;
  /** Reserve each row's amount at the inline-end (order totals). */
  amount?: boolean;
};

/** Placeholder for a stacked list of record rows (`flex flex-col gap-3`). */
export function RecordListSkeleton({ rows = 4, amount = false }: RecordListSkeletonProps) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <RecordRowSkeleton key={index} amount={amount} />
      ))}
    </div>
  );
}
