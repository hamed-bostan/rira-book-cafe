/**
 * Turn Next's `searchParams` prop into a real `URLSearchParams`.
 *
 * Pages receive query params as a plain object whose values are `string`,
 * `string[]` (a repeated param) or `undefined`. Every parser in `lib/api` is
 * written against `URLSearchParams` so that the code building a URL on the client
 * and the code reading it on the server share one contract — this is the adapter
 * between the two, rather than a second set of object-shaped parsers.
 *
 * Repeated params are preserved as repeats, so a caller that appends multiple
 * values (the storefront's `dietary`/`brand`) round-trips unchanged.
 */
export function toSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else params.set(key, value);
  }

  return params;
}
