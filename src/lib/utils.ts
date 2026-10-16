import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Our generated typography utilities (`text-heading-*`, `text-body-*`,
 * `text-button-*`, `text-label-*`) are FONT-SIZE utilities. tailwind-merge
 * doesn't know that, so by default it treats `text-body-default` as a text COLOR
 * and collapses it against real color utilities like `text-input-foreground`,
 * silently dropping one of them (order-dependent).
 *
 * Registering the namespace in the `font-size` group makes size + color coexist,
 * while still letting two font sizes correctly override each other.
 */
const isTypographyToken = (value: string) => /^(heading|body|button|label)-/.test(value);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [isTypographyToken] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
