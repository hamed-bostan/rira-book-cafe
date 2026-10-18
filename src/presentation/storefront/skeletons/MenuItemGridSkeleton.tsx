import { MenuItemCardSkeleton } from "./MenuItemCardSkeleton";

type MenuItemGridSkeletonProps = {
  /** Cards to draw. */
  count?: number;
};

/** Placeholder for the product grid: two columns on phones, three from `sm`, four from `lg`. */
export function MenuItemGridSkeleton({ count = 8 }: MenuItemGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <MenuItemCardSkeleton key={index} />
      ))}
    </div>
  );
}
