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

/** One unmatched line on either side of the workspace; the whole row ticks its box. */
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
          "flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-1 sm:min-h-10",
          disabled ? "cursor-default" : "cursor-pointer",
        )}
      >
        <Checkbox
          checked={picked}
          disabled={disabled}
          onCheckedChange={(checked) => onPickedChange(checked === true)}
          aria-label={pickLabel}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium [overflow-wrap:anywhere] text-foreground" dir="auto">
            {description}
          </span>
          <span className={cn(ROW_CAPTION, late && "text-warning-foreground")}>{meta}</span>
        </span>
        <span
          className={cn(
            "font-semibold whitespace-nowrap tabular-nums",
            moneyIn ? "text-success-foreground" : "text-foreground",
          )}
        >
          {amount}
        </span>
      </label>
      {end}
    </div>
  );
}
