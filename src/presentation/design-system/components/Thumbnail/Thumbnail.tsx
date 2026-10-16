import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

const thumbnailVariants = cva(
  [
    // These four always travel together, and dropping one is a real bug rather
    // than a style nit: without `overflow-hidden` a square image escapes the
    // rounded corners, and without `shrink-0` a greedy flex sibling (a long
    // product name) squeezes the frame out of its 1:1 aspect ratio.
    "flex shrink-0 items-center justify-center overflow-hidden",
  ],
  {
    variants: {
      /**
       * `sunken` — the recessed well a product or category image sits in, the
       * default. `surface` — for a thumbnail on an already-sunken background,
       * where the usual well would disappear into it.
       */
      tone: {
        sunken: "bg-surface-sunken",
        surface: "bg-surface",
      },

      /** Matches the card radius scale, so a thumbnail nests inside a card cleanly. */
      radius: {
        md: "rounded-card-md",
        lg: "rounded-card-lg",
        xl: "rounded-card-xl",
      },
    },

    defaultVariants: {
      tone: "sunken",
      radius: "md",
    },
  },
);

/**
 * The elements a thumbnail actually needs to be: a block by default, a `span`
 * inside a link or a text row, or an `li` in a gallery list.
 */
type ThumbnailElement = "div" | "span" | "li";

export interface ThumbnailProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof thumbnailVariants> {
  as?: ThumbnailElement;
}

/**
 * The framed well an image sits in — a clipped, rounded square that centres
 * whatever it's given.
 *
 * Like `<DataTable>`, it deliberately says nothing about its contents: the image
 * keeps its own sizing, because the inset is a real design decision that differs
 * per call site (a category icon sits at 32px inside a 40px well, while a product
 * photo fills its frame edge to edge).
 *
 * The frame carries no size of its own either — pass it through `className`
 * (`size-10`, `size-20`), written out in full so the Tailwind scanner can see it.
 */
export const Thumbnail = ({ as: Component = "div", className, tone, radius, ...props }: ThumbnailProps) => (
  <Component className={cn(thumbnailVariants({ tone, radius }), className)} {...props} />
);
