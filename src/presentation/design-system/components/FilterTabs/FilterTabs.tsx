"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../shared/focusRing";

const filterTabsVariants = cva("", {
  variants: {
    /**
     * `scroll` — an open-ended list that runs off the edge (a category filter).
     * `grid` — a fixed, small set sharing the width evenly (a two-way segmented
     * control). `grid-flow-col` + `auto-cols-fr` sizes the columns from however
     * many tabs there are, so the count never has to be declared.
     */
    layout: {
      scroll: "scrollbar-hide flex gap-2 overflow-x-auto",
      grid: "grid auto-cols-fr grid-flow-col gap-3",
    },
  },

  defaultVariants: { layout: "scroll" },
});

const filterTabVariants = cva(
  [
    "flex items-center justify-center rounded-full px-4 whitespace-nowrap",
    "text-button-default-medium transition-colors",
    "border text-foreground",
    focusRing,
  ],
  {
    variants: {
      /**
       * `plain` — the tab reads as text until chosen, then outlines itself. For a
       * long scrolling list, where a border on every tab would be noise.
       * `outlined` — every tab is a visible target, the chosen one tinted. For a
       * short segmented control, where the unchosen options must stay findable.
       */
      variant: {
        plain: "border-transparent data-[state=checked]:border-primary data-[state=checked]:text-primary",
        outlined:
          "border-border data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:text-primary",
      },

      size: {
        sm: "h-9",
        md: "h-11",
      },
    },

    defaultVariants: { variant: "plain", size: "sm" },
  },
);

type FilterTabStyleProps = Required<VariantProps<typeof filterTabVariants>>;

/**
 * Lets `FilterTabs` set the look once for the whole group instead of every tab
 * repeating it inside the caller's `map`. A tab may still override either axis.
 */
const FilterTabsContext = React.createContext<FilterTabStyleProps>({
  variant: "plain",
  size: "sm",
});

export interface FilterTabsProps
  extends
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
    VariantProps<typeof filterTabsVariants>,
    VariantProps<typeof filterTabVariants> {}

/**
 * A horizontal, single-select filter bar: exactly one tab active, with Radix
 * supplying roving tab-index and arrow-key navigation (one tab stop for the whole
 * group, as the ARIA radio pattern requires).
 *
 * `layout` positions the tabs; `variant` and `size` set the look of every tab in
 * the group. Requires an accessible name via `aria-label` / `aria-labelledby`.
 *
 *   <FilterTabs layout="grid" variant="outlined" size="md" value={phase} …>
 *     <FilterTab value="current">Current</FilterTab>
 *   </FilterTabs>
 *
 * Page-gutter bleed (`-mx-6 px-6`, so a scrolling bar reaches the screen edges
 * while its first tab stays on the gutter) belongs to the page, not here — pass
 * it through `className`.
 */
export const FilterTabs = React.forwardRef<HTMLDivElement, FilterTabsProps>(
  ({ className, layout, variant = "plain", size = "sm", children, ...props }, ref) => {
    // Memoised so tabs don't re-render on every parent render just to read a
    // freshly-allocated object with the same two values in it.
    const style = React.useMemo(() => ({ variant, size }), [variant, size]);

    return (
      <FilterTabsContext.Provider value={style}>
        <RadioGroupPrimitive.Root
          ref={ref}
          orientation="horizontal"
          loop
          className={cn(filterTabsVariants({ layout }), className)}
          {...props}
        >
          {children}
        </RadioGroupPrimitive.Root>
      </FilterTabsContext.Provider>
    );
  },
);

FilterTabs.displayName = "FilterTabs";

export interface FilterTabProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>, VariantProps<typeof filterTabVariants> {}

/** A single tab; must live inside a `<FilterTabs>`. */
export const FilterTab = React.forwardRef<HTMLButtonElement, FilterTabProps>(
  ({ className, variant, size, ...props }, ref) => {
    const group = React.useContext(FilterTabsContext);

    return (
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          filterTabVariants({ variant: variant ?? group.variant, size: size ?? group.size }),
          // Only meaningful in the scrolling layout, where a tab would otherwise
          // be squeezed by its siblings instead of overflowing the container.
          "shrink-0",
          className,
        )}
        {...props}
      />
    );
  },
);

FilterTab.displayName = "FilterTab";
