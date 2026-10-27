import { FolderTree, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { CategoryRow } from "./CategoryRow";

type CategoriesScreenProps = {
  /** Every category, in the order guests see them on the menu. */
  categories: Category[];
};

/**
 * The menu's categories, in the order guests see them, numbered — with up/down
 * buttons to move one, and Edit / Hide from menu / Delete behind "⋯". A
 * category's name opens Menu items on that category. Presentational: the page
 * fetches over the REST API (BFF) during server render; every action writes over
 * the API and `router.refresh()`es, so the server stays the single source of truth.
 */
export async function CategoriesScreen({ categories }: CategoriesScreenProps) {
  const t = await getTranslations("dashCategories");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        <Button size="control-md" asChild className="gap-2 px-4">
          <Link href="/dashboard/categories/create">
            <Icon icon={Plus} size="sm" />
            {t("newCategory")}
          </Link>
        </Button>
      </div>

      <section
        aria-label={t("heading")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        {categories.length > 0 ? (
          <ol>
            {categories.map((category, index) => (
              <li key={category.id} className={cn(index > 0 && "border-t border-border")}>
                <CategoryRow
                  category={category}
                  position={index + 1}
                  isFirst={index === 0}
                  isLast={index === categories.length - 1}
                />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={FolderTree} title={t("emptyTitle")} description={t("emptyBody")} className="py-12" />
        )}
      </section>
    </div>
  );
}
