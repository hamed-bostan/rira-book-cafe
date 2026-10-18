import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

/**
 * Localized 404 for unmatched URLs under the `[locale]` segment (routed here by the
 * `[...rest]` catch-all). Renders inside the locale layout, so lang/dir/font and the
 * active language all apply — unlike the framework's default English 404. A page
 * that calls `notFound()` lands on the nearer boundary of its own area instead
 * (`(main)/not-found.tsx`, `dashboard/not-found.tsx`), which keeps that area's chrome.
 */
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center">
      <EmptyState
        size="page"
        icon={SearchX}
        title={t("title")}
        description={t("body")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t("goHome")}</Link>
          </Button>
        }
      />
    </main>
  );
}
