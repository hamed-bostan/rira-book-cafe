"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/presentation/design-system/components/Popover/Popover";

type ListFilterPopoverProps = {
  /** The filter's name, shown on the trigger ("Status", "Date"). */
  label: string;
  /**
   * What the filter currently narrows to, shown in place of nothing when it's
   * active ("Out for delivery", "Last 7 days"). Omitted while the filter is off,
   * which is what makes an active filter legible without opening it.
   */
  value?: string;
  /** Overrides whether the value represents an applied filter. */
  isActive?: boolean;
  /** Icon shown before the label. */
  icon?: React.ReactNode;
  /** The panel's contents — the options, range fields, or nested filters. */
  children: React.ReactNode;
  /** Width of the panel. Defaults to a single column of options. */
  contentClassName?: string;
  /** Layout overrides for the trigger, such as a full-width phone toolbar. */
  triggerClassName?: string;
  disabled?: boolean;
  triggerId?: string;
  triggerAriaDescribedBy?: string;
  triggerAriaInvalid?: boolean;
};

/**
 * The toolbar's filter control: a button that opens a panel.
 *
 * A popover rather than the `<select>` the lists started with, because the
 * filters outgrew what a select can express — a date range is two fields and a
 * set of presets, and "more filters" is several filters at once. Rather than
 * having some filters be selects and others buttons, they're all this, so the
 * toolbar reads as one row of the same control.
 *
 * The trigger states its own value when it has one. A filter bar whose buttons
 * all read the same whether or not they're doing anything is the standing bug in
 * this pattern: someone leaves a filter on, forgets, and reports the list as
 * broken. Showing the value costs a word and removes the whole failure.
 *
 * Layout only — it holds no filter state. What goes in the panel decides what
 * params get written, and every one of those writes through `useListParams`, so
 * a filter change stays a navigation and the server stays the source of truth.
 */
export function ListFilterPopover({
  label,
  value,
  isActive,
  icon,
  children,
  contentClassName,
  triggerClassName,
  disabled = false,
  triggerId,
  triggerAriaDescribedBy,
  triggerAriaInvalid,
}: ListFilterPopoverProps) {
  const active = isActive ?? value != null;

  return (
    <Popover>
      <PopoverTrigger
        id={triggerId}
        aria-describedby={triggerAriaDescribedBy}
        aria-invalid={triggerAriaInvalid}
        disabled={disabled}
        className={cn(
          "group flex h-11 cursor-pointer items-center gap-1.5 rounded-button border px-3 text-body-small whitespace-nowrap transition-colors sm:h-10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          // An active filter is carried by border and text colour, never by
          // colour alone — the value beside the label is the primary signal, so
          // this still reads for anyone who can't tell the two borders apart.
          active
            ? "border-accent-border bg-accent text-foreground hover:border-primary"
            : "border-border bg-background text-foreground hover:border-border-strong",
          triggerClassName,
        )}
      >
        {icon}
        {/* With a value beside it the label is just the field's name, so it steps
            back; on its own it *is* the reading, so it keeps the ink. */}
        <span dir="auto" className={cn("min-w-0 truncate", value != null && "text-muted-foreground")}>
          {label}
        </span>
        {value != null ? (
          <span className={cn("max-w-32 truncate font-medium", active ? "text-accent-foreground" : "text-foreground")}>
            {value}
          </span>
        ) : null}
        {/* Rotates with the panel, so the trigger says whether it's open without
            depending on the panel being visible on screen. */}
        <Icon
          icon={ChevronDown}
          className="ms-auto size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180 sm:size-4"
        />
      </PopoverTrigger>

      <PopoverContent className={cn("w-56", contentClassName)}>{children}</PopoverContent>
    </Popover>
  );
}
