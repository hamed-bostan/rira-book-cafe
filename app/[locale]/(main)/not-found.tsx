import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button, EmptyState } from "@/src/presentation/design-system";

/**
 * 404 for public pages that call `notFound()` (an unknown menu item, event or
 * order). Lives inside the public layout, so the header and bottom bar stay and
 * the guest can carry on browsing instead of landing on a bare page.
 */
export default async function StorefrontNotFound() {
  const t = await getTranslations("notFound");
  const tSite = await getTranslations("site");

  return (
    <EmptyState
      size="page"
      icon={SearchX}
      title={t("title")}
      description={t("body")}
      action={
        <>
          <Button asChild size="sm">
            <Link href="/menu">{tSite("home.seeMenu")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t("goHome")}</Link>
          </Button>
        </>
      }
    />
  );
}
