import { cookies } from "next/headers";

import { PAGE_SIZE_COOKIE_NAME, rememberedPageSize, type PageSizeChoices } from "./pageSizeCookie";

/**
 * A list page's query params with the remembered rows-per-page filled in, when the
 * URL doesn't name a size itself. Server-only (reads the request cookies); the URL
 * always wins, so a pasted link shows what its sender saw.
 */
export async function withRememberedPageSize(
  params: URLSearchParams,
  choices?: PageSizeChoices,
): Promise<URLSearchParams> {
  if (params.has("pageSize")) return params;
  const size = rememberedPageSize((await cookies()).get(PAGE_SIZE_COOKIE_NAME)?.value, choices);
  if (size === undefined) return params;
  const next = new URLSearchParams(params);
  next.set("pageSize", String(size));
  return next;
}
