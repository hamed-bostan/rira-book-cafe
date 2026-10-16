"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRingWithin } from "../shared/focusRing";

const selectableTileVariants = cva(
  [
    "flex w-full cursor-pointer items-center rounded-card-xl border bg-surface transition-colors",
    // The real control is an `sr-only` radio inside the tile, so the ring has to
    // key off a focused *descendant* rather than the tile itself.
    focusRingWithin,
    "has-disabled:cursor-not-allowed has-disabled:opacity-50",
  ],
  {
    variants: {
      /** Vertical density: `sm` for a single line of content, `md` for two. */
      size: {
        sm: "gap-2 px-4 py-2",
        md: "gap-3 px-4 py-3",
      },

      /**
       * `start` packs the content against the leading edge (icon + label);
       * `between` pushes a trailing element to the far edge (a price, a badge).
       */
      align: {
        start: "justify-start",
        between: "justify-between",
      },

      selected: {
        true: "border-foreground",
        // Transparent rather than absent, so selecting doesn't change the tile's
        // box size and shift the row.
        false: "border-transparent",
      },
    },

    defaultVariants: {
      size: "md",
      align: "start",
      selected: false,
    },
  },
);

type SelectableTileVariants = VariantProps<typeof selectableTileVariants>;

export interface SelectableTileProps extends Omit<SelectableTileVariants, "selected"> {
  /** Shared across the tiles of one group — this is what makes them one radio group. */
  name: string;
  /** The value this tile submits when chosen. */
  value: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Applied to the tile wrapper. */
  className?: string;
  children?: React.ReactNode;
}

/**
 * A selectable card: a whole tile that acts as one option in a single-select
 * group, with arbitrary content inside (icon and label, or a two-line block with
 * a trailing status).
 *
 * Built on a native radio rather than Radix RadioGroup because these tiles are
 * submitted as part of a real `<form>` — the native control carries the value,
 * gives the group arrow-key navigation and one tab stop for free, and needs no
 * JavaScript to be reachable. It is `sr-only`, so selection is conveyed visually
 * by the highlighted border and focus by the ring.
 *
 * For a compact pill rather than a full-width card, use `<Chip>`.
 */
export function SelectableTile({
  name,
  value,
  selected,
  onSelect,
  disabled = false,
  size,
  align,
  className,
  children,
}: SelectableTileProps) {
  return (
    <label className={cn(selectableTileVariants({ size, align, selected }), className)}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      {children}
    </label>
  );
}
