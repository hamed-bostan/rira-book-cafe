import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Locale-aware navigation primitives — drop-in replacements for `next/link` and
// `next/navigation`. Under `localePrefix: "never"` the locale lives in a cookie, not the
// URL, so these don't add a path prefix; they exist so the whole app routes through
// next-intl's helpers (consistent pathname handling, and a single switch point if the
// locale strategy ever changes). Components import `Link`/`useRouter`/`usePathname` from
// here, never from `next/link` or `next/navigation`.
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
