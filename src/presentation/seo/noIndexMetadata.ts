import type { Metadata } from "next";

/** Keep a page out of search results and don't follow its links (sign-in, account, dashboard). */
export const NO_INDEX: NonNullable<Metadata["robots"]> = { index: false, follow: false };

/** Metadata for a private or utility page: a tab title, but never indexed. */
export function noIndexMetadata(title?: string): Metadata {
  return { title, robots: NO_INDEX };
}
