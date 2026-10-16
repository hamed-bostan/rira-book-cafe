"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { usePathname, useRouter } from "@/src/i18n/navigation";

/**
 * Read and write the query string that drives an admin list.
 *
 * List state (page, sort, filters) lives in the URL rather than in component
 * state, which is what lets the screens stay server-rendered: a change here is a
 * navigation, Next re-runs the server render with the new params, and the table
 * receives fresh rows. There's no client-side copy of the data to keep in sync —
 * the same rule the mutation flows already follow with `router.refresh()`.
 *
 * (`useSearchParams` comes from `next/navigation` because the locale-aware
 * `@/src/i18n/navigation` doesn't wrap it — there's nothing locale-dependent
 * about reading the query string. `useRouter`/`usePathname` still come from the
 * i18n helpers, as everywhere else.)
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Navigate to the current route with a new query string.
   *
   * `replace`, not `push`: paging and sorting a table shouldn't stack history
   * entries that the Back button then has to walk through one at a time.
   *
   * The href is built from the current pathname rather than left as a bare
   * `?query`, so it doesn't depend on how the router resolves a query-only href.
   * `usePathname` comes from the i18n helpers, so this stays correct if the locale
   * strategy ever stops being cookie-based.
   */
  const setParams = useCallback(
    (next: URLSearchParams) => {
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: true });
    },
    [router, pathname],
  );

  /**
   * Set or clear a single param, always returning to page 1.
   *
   * Resetting the page is the point: changing a filter while on page 7 of the
   * old result set usually lands on an empty page, which reads as "no results"
   * for a filter that in fact matched plenty.
   */
  const setFilter = useCallback(
    (name: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(name, value);
      else next.delete(name);
      next.delete("page");
      setParams(next);
    },
    [searchParams, setParams],
  );

  return { searchParams, setParams, setFilter };
}
