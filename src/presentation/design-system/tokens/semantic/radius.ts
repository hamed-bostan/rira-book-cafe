import { radius as primitiveRadius } from "../primitives/radius";

/**
 * Semantic radii, named by the surface they round. Names map to INTENT, not to
 * the primitive scale: a component gets sized variants (a local `lg`, etc.) only
 * when it genuinely uses more than one radius, otherwise it's a single scalar.
 */
export const radius = {
  // Interactive controls.
  button: {
    DEFAULT: primitiveRadius.xl, // standard buttons → `rounded-button`
    lg: primitiveRadius["2xl"], // prominent full-width CTAs → `rounded-button-lg`
  },
  input: primitiveRadius.xl, // text fields, pickers → `rounded-input`

  // Surfaces / containers — the one token with a real multi-step scale.
  card: {
    md: primitiveRadius.md,
    lg: primitiveRadius.lg,
    xl: primitiveRadius.xl,
  },

  // Single-radius elements.
  badge: {
    md:primitiveRadius.md,
    lg:primitiveRadius["2xl"],
  },
  modal: primitiveRadius.lg,
  sheet: primitiveRadius["2xl"],
  pill: primitiveRadius.full,
} as const;
