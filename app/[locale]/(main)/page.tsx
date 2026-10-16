import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system";

/** Public home. A placeholder until the storefront (menu, books, reservations) is built. */
export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-heading-page text-foreground">{t("title")}</h1>
      <p className="text-body-default text-muted-foreground">{t("body")}</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">{t("dashboard")}</Link>
      </Button>
    </section>
  );
}
