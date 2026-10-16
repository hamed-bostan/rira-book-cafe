/**
 * Persists the desktop sidebar's collapsed/expanded choice across visits, the
 * same sticky-preference pattern as the locale cookie (`LOCALE_COOKIE_NAME`):
 * read server-side in the layout so the first paint already matches, written
 * client-side by the toggle with no reload needed — collapsing is pure layout,
 * nothing here depends on a fresh server render the way a locale switch does.
 */
export const SIDEBAR_COLLAPSED_COOKIE_NAME = "dashboard-sidebar-collapsed";
export const SIDEBAR_COLLAPSED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
