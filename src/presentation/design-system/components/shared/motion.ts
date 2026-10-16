/**
 * How the design system treats `prefers-reduced-motion: reduce`.
 *
 * The setting is a request to remove motion that can trigger vestibular
 * discomfort — things that travel, scale, or loop. It is NOT a request to strip
 * every animation, and treating it that way makes an interface feel broken. So
 * the policy is deliberately selective:
 *
 * SUPPRESSED
 *  - Transitions on transform, position and size (a switch thumb sliding, a
 *    chevron rotating, a label travelling to the field border). The end state
 *    still applies — it just arrives instantly.
 *  - Slide and zoom entrances on overlays. A sheet that flies up from the bottom
 *    of the screen is the largest movement in the app.
 *  - Looping animation, such as a skeleton's pulse.
 *
 * KEPT ON PURPOSE
 *  - Colour transitions. A hover or checked colour easing in isn't motion in the
 *    sense that matters here, and it carries real feedback about state.
 *  - Fades. Opacity doesn't move anything, so a fade is also what an overlay
 *    falls back to once its slide or zoom is suppressed — the dialog still reads
 *    as arriving, rather than snapping into place.
 *  - The spinner. A frozen busy indicator doesn't read as "reduced motion", it
 *    reads as a hung application, which is worse than the animation it avoids.
 */

/**
 * Append to a transition that moves or resizes something, so it settles
 * instantly for users who asked for less motion. Pair with `motion-safe:` on the
 * transform utility itself when the transform shouldn't apply at all.
 */
export const stillWhenReduced = "motion-reduce:transition-none";
