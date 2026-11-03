import { cn } from "@/src/lib/utils";
import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";

import { ROW_CAPTION } from "../pageStyles";

import type { ReactNode } from "react";

type MatchLineProps = {
  description: string;
  /** The line under the description: its date, and its reference or source. */
  meta: ReactNode;
  /** The books date this after the statement's period. */
  late?: boolean;
  /** The amount, signed and formatted. */
  amount: string;
  moneyIn: boolean;
  picked: boolean;
  /** Who can't change the matches sees the box, dimmed. */
  disabled: boolean;
  pickLabel: string;
  onPickedChange: (picked: boolean) => void;
  /** What sits past the amount: a link to the entry, or the line's "⋯". */
  end?: ReactNode;
};

/**
 * One unmatched line on either side of the workspace; the whole row ticks its box.
 *
 * In a narrow list (a phone, or one side of the two-up workspace beside the summary)
 * it reads down like a bank app's: the description, the amount, then the date and
 * reference, each across the row, so none is squeezed beside another. From a 24rem
 * list the amount sits beside the description. The list is the `side` container.
 */
export function MatchLine({
  description,
  meta,
  late = false,
  amount,
  moneyIn,
  picked,
  disabled,
  pickLabel,
  onPickedChange,
  end,
}: MatchLineProps) {
  return (
    <div className={cn("flex items-center gap-2 py-2 ps-2 pe-3", picked && "bg-accent")}>
      <label
        className={cn(
          "grid min-h-11 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] content-center items-baseline gap-x-3 gap-y-0.5 px-2 py-1 sm:min-h-10",
          disabled ? "cursor-default" : "cursor-pointer",
        )}
      >
        {/* Every cell names its grid lines: a `span` would reset the start and set
            the cell loose to wherever auto-placement puts it. */}
        <Checkbox
          checked={picked}
          disabled={disabled}
          onCheckedChange={(checked) => onPickedChange(checked === true)}
          aria-label={pickLabel}
          className="col-start-1 row-start-1 row-end-4 self-center @sm/side:row-end-3"
        />
        <span
          className="col-start-2 col-end-4 row-start-1 font-medium [overflow-wrap:anywhere] text-foreground @sm/side:col-end-3"
          dir="auto"
        >
          {description}
        </span>
        {/* Left to right, so the sign leads the figure in Persian as well; placed by
            the grid's own direction, at the row's start or, beside the description, its end. */}
        <span
          dir="ltr"
          className={cn(
            "col-start-2 col-end-4 row-start-2 justify-self-start font-semibold whitespace-nowrap tabular-nums",
            "@sm/side:col-start-3 @sm/side:row-start-1 @sm/side:justify-self-end",
            moneyIn ? "text-success-foreground" : "text-foreground",
          )}
        >
          {amount}
        </span>
        <span
          className={cn(
            ROW_CAPTION,
            "col-start-2 col-end-4 row-start-3 @sm/side:col-end-3 @sm/side:row-start-2",
            late && "text-warning-foreground",
          )}
        >
          {meta}
        </span>
      </label>
      {end}
    </div>
  );
}
