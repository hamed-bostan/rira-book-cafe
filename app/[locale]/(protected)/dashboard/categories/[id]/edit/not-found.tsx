import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system";

/** Shown when editing a category that no longer exists (the page called `notFound()`). */
export default async function EditCategoryNotFound() {
  const t = await getTranslations("dashCategories");

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-heading-section text-foreground">{t("notFoundTitle")}</h1>
      <p className="text-body-small text-muted-foreground">{t("notFoundBody")}</p>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/dashboard/categories">{t("backToCategories")}</Link>
      </Button>
    </div>
  );
}
