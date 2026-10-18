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

/**
 * Press feedback for a small control (a button, an icon button): it gives
 * slightly under the finger. Motion-safe only; the colour change on press
 * still carries the feedback when motion is reduced.
 */
export const pressable = "motion-safe:active:scale-[0.97]";

/**
 * Hover/press feedback for a whole clickable card (a menu item, an event, a
 * linked KPI tile): it lifts a little and gains a shadow on hover, and settles
 * on press. The lift and press are motion-safe; the shadow is not motion and
 * stays, so a reduced-motion pointer still sees the card respond.
 */
export const interactiveCard = [
  "transition-[translate,scale,box-shadow,background-color] duration-200 ease-out",
  "hover:shadow-md",
  "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.99]",
].join(" ");

/**
 * For an image inside an `interactiveCard` (the card carries `group`): a slow,
 * slight zoom on hover. Motion-safe only.
 */
export const zoomOnGroupHover = "transition-transform duration-500 ease-out motion-safe:group-hover:scale-105";
