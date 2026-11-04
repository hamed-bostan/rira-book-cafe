import { useLocale } from "next-intl";

import { optionsSummary, type OrderItemOption } from "@/src/domain/entities/ProductOptions";
import { cn } from "@/src/lib/utils";

type OrderItemOptionsProps = {
  /** The options the line snapshotted; nothing renders without them. */
  options: readonly OrderItemOption[] | undefined;
  className?: string;
};

/**
 * The options chosen for an order line — "Large, Oat milk" — in the reader's
 * language, under the line's name: on the order, the bar's ticket, the receipt and
 * the guest's own order. Read from the line's snapshot, so it shows what was
 * ordered even after the item's options changed.
 */
export function OrderItemOptions({ options, className }: OrderItemOptionsProps) {
  const locale = useLocale();
  const text = optionsSummary(options, locale);
  if (!text) return null;
  return (
    <span
      dir="auto"
      data-testid="line-options"
      className={cn("block text-body-caption text-muted-foreground", className)}
    >
      {text}
    </span>
  );
}
