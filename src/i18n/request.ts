import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

// Per-request i18n config consumed by next-intl on the server. Resolves the active
// locale (falling back to the default for unknown/absent values) and loads that
// locale's message catalog. Message catalogs live at the repo root under `messages/`
// — a presentation/framework concern, never imported by `domain` or `infrastructure`.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const catalog = (await import(`../../messages/${locale}.json`)) as { default: Record<string, unknown> };

  return {
    locale,
    messages: catalog.default,
  };
});
