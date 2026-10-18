/**
 * The single keyboard-focus treatment for the whole design system.
 *
 * Every interactive control uses this, so focus reads identically everywhere
 * instead of drifting between `ring`, `ring-2`, and `ring-2 ring-offset-2`.
 * `focus-visible` (not `focus`) keeps the ring off pointer interactions.
 *
 * The dark green ring is separated from every control by a white gap so it
 * remains visible next to solid green buttons as well as light surfaces.
 * `focusRingOffset` is retained as an alias for existing component callers.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const focusRingOffset = focusRing;

/**
 * The same treatment keyed off a *descendant* receiving focus, for controls
 * whose real input is visually hidden inside a wrapper (e.g. a chip wrapping an
 * `sr-only` checkbox). Pair with the hidden input, never with a focusable host.
 */
export const focusRingWithin =
  "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background";
