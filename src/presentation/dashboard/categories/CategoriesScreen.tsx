import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import { Link } from "@/src/i18n/navigation";
import { BulkSelectAllCheckbox, BulkSelectionProvider, BulkStickyBar } from "@/src/presentation/dashboard/bulk";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";

import { CategoryBulkActions } from "./CategoryBulkActions";
import { CategoryRow } from "./CategoryRow";
import { SortableCategoryList, type SortableCategory } from "./SortableCategoryList";

type CategoriesScreenProps = {
  /** Every category, in menu order: each top-level one followed by its subcategories. */
  categories: Category[];
};

/**
 * The menu's categories, in the order guests see them: the top-level ones, each
 * with its subcategories indented beneath it. Each sits in a numbered place among
 * its siblings, moved with up/down buttons or dragged by its grip (a top-level
 * category drags with its subcategories; a subcategory stays under its parent).
 * Edit / Hide from menu / Delete sit behind "⋯", and a category's name opens Menu
 * items on it. Rows can be ticked to show or hide several at once.
 *
 * Presentational: the page fetches over the REST API (BFF) during server render;
 * every action writes over the API and `router.refresh()`es, so the server stays
 * the single source of truth.
 */
export async function CategoriesScreen({ categories }: CategoriesScreenProps) {
  const t = await getTranslations("dashCategories");

  const topLevel = categories.filter((category) => category.parentId === null);
  const ids = new Set(categories.map((category) => category.id));
  const childrenOf = (id: string): Category[] => categories.filter((category) => category.parentId === id);
  // A subcategory whose parent isn't in the list (can't happen through the API)
  // still shows, at the top level, rather than vanishing.
  const strays = categories.filter((category) => category.parentId !== null && !ids.has(category.parentId));

  function row(category: Category, index: number, siblings: Category[], nested: boolean): React.ReactNode {
    return (
      <CategoryRow
        category={category}
        position={index + 1}
        isFirst={index === 0}
        isLast={index === siblings.length - 1}
        nested={nested}
        subcategoryCount={nested ? 0 : childrenOf(category.id).length}
      />
    );
  }

  const groups: SortableCategory[] = topLevel.map((category, index) => {
    const children = childrenOf(category.id);
    return {
      id: category.id,
      name: category.name,
      content: (
        <>
          {row(category, index, topLevel, false)}
          {children.length > 0 ? (
            <SortableCategoryList
              parentId={category.id}
              label={t("subcategoriesOf", { name: category.name })}
              className="border-t border-border bg-muted/40 ps-6 sm:ps-10"
              items={children.map((child, childIndex) => ({
                id: child.id,
                name: child.name,
                content: row(child, childIndex, children, true),
              }))}
            />
          ) : null}
        </>
      ),
    };
  });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        <Button size="control-md" asChild className="gap-2 px-4">
          <Link href="/dashboard/categories/create">
            <Icon icon={Plus} size="icon-md" />
            {t("newCategory")}
          </Link>
        </Button>
      </div>

      <BulkSelectionProvider ids={categories.map((category) => category.id)}>
        <section
          aria-label={t("heading")}
          className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
        >
          {categories.length > 0 ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-5 py-2 text-body-default text-muted-foreground sm:text-body-small">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-0">
                  <BulkSelectAllCheckbox label={t("selectAllAria")} />
                  <span aria-hidden>{t("selectAll")}</span>
                </label>
                <span className="ms-auto hidden sm:inline">{t("dragHint")}</span>
              </div>
              <SortableCategoryList parentId={null} label={t("heading")} items={groups} />
              {strays.length > 0 ? (
                <ol className="border-t border-border">
                  {strays.map((category, index) => (
                    <li key={category.id} className={index > 0 ? "border-t border-border" : undefined}>
                      {row(category, index, strays, false)}
                    </li>
                  ))}
                </ol>
              ) : null}
              <BulkStickyBar
                actions={
                  <CategoryBulkActions
                    categories={categories.map(({ id, name, isActive, parentId }) => ({
                      id,
                      name,
                      isActive,
                      parentId,
                    }))}
                  />
                }
              />
            </>
          ) : (
            <DashboardEmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          )}
        </section>
      </BulkSelectionProvider>
    </div>
  );
}
