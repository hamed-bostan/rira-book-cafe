/**
 * A page can take the whole screen — the bar display on a wall at the counter.
 * While this attribute is on `<html>`, the shell's chrome (rail, top bar, bottom
 * tabs) steps aside and the page gets the full width. The page sets it when it
 * goes full screen and removes it when it leaves full screen or unmounts.
 */
export const DASHBOARD_FULL_SCREEN_ATTRIBUTE = "data-dashboard-full-screen";

/**
 * On each piece of chrome: hidden while a page is full screen. Written out in full
 * (not built from the constant above) so Tailwind finds the class; the selector's
 * extra specificity beats the chrome's own responsive `flex`.
 */
export const HIDDEN_IN_FULL_SCREEN = "[html[data-dashboard-full-screen]_&]:hidden";
