import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system";

/**
 * Localized 404 for everything under the `[locale]` segment: pages that call
 * `notFound()` (unknown product/category ids) and unmatched URLs (routed here by the
 * `[...rest]` catch-all). Renders inside the locale layout, so lang/dir/font and the
 * active language all apply — unlike the framework's default English 404.
 */
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-heading-section text-foreground">{t("title")}</h1>
      <p className="text-body-small text-muted-foreground">{t("body")}</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </main>
  );
}
