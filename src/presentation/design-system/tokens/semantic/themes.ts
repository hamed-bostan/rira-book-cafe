import { blue, neutral, navy, paletteAmber, paletteRed, slate, teal } from "../primitives/colors";
import { radius as primitiveRadius } from "../primitives/radius";

import type { colors } from "./colors";
import type { radius } from "./radius";

/** Any subset of a token tree, with values widened to `string` (the base trees are `as const`). */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : string };

/** A theme repoints some of the semantic tokens for one part of the app. */
type Theme = {
  colors: DeepPartial<typeof colors>;
  radius: DeepPartial<typeof radius>;
  /** Line weight of every `Icon` (lucide's default is 2) → `--icon-stroke`. */
  iconStroke?: string;
};

/**
 * Themes, applied with `data-theme="<name>"` on an element: inside it, the same
 * utilities (`bg-primary`, `rounded-button`, …) resolve to the theme's values.
 * Components never name a theme; they keep using the semantic tokens.
 *
 * `admin` is the dashboard, one-for-one with the Rira design project's admin
 * pages ("Dashboard Orders v2"): navy ink on a pale slate canvas, white cards
 * with hairline borders, teal actions, tinted status badges with soft borders,
 * square-ish 4px corners (8px on cards) that echo the logo's angular cut, and
 * lighter 1.75 icon strokes.
 */
export const themes = {
  admin: {
    colors: {
      background: neutral[0],
      foreground: navy[900],
      canvas: slate[50],
      surface: { DEFAULT: slate[50], sunken: slate[100] },
      popover: { DEFAULT: neutral[0], foreground: navy[900] },
      primary: { DEFAULT: teal[600], foreground: neutral[0], hover: teal[700], pressed: teal[800] },
      disabled: { DEFAULT: slate[100], foreground: slate[400], border: slate[300] },
      muted: { DEFAULT: slate[100], foreground: slate[600], strong: slate[200] },
      accent: { DEFAULT: teal[50], foreground: teal[700], strong: teal[100], border: teal[300] },
      destructive: { DEFAULT: paletteRed[700], foreground: neutral[0] },
      success: { DEFAULT: teal[50], foreground: teal[700], border: teal[200] },
      warning: {
        DEFAULT: paletteAmber[50],
        foreground: paletteAmber[700],
        strong: paletteAmber[800],
        border: paletteAmber[200],
      },
      info: { DEFAULT: blue[50], foreground: blue[700], border: blue[200] },
      error: { DEFAULT: paletteRed[50], foreground: paletteRed[700], border: paletteRed[200] },
      icon: { muted: slate[600], accent: blue[700] },
      input: { DEFAULT: neutral[0], filled: slate[50], foreground: navy[900], placeholder: slate[600] },
      border: { DEFAULT: slate[200], strong: slate[300] },
      ring: teal[600],
    },
    radius: {
      button: { DEFAULT: primitiveRadius.sm, lg: primitiveRadius.sm },
      input: primitiveRadius.sm,
      card: { md: primitiveRadius.sm, lg: primitiveRadius.md, xl: primitiveRadius.md },
      badge: { md: primitiveRadius.sm },
    },
    iconStroke: "1.75",
  },
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;
