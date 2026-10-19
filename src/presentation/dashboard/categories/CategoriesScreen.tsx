import { FolderTree, Plus, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ADMIN_CATEGORY_STATUSES, type AdminCategoryFilters } from "@/src/domain/entities/AdminCategoryFilters";
import type { Category } from "@/src/domain/entities/Category";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { BulkActionBar, BulkSelectionProvider } from "@/src/presentation/dashboard/bulk";
import { ListFilterSelect, ListPager, ListSearchInput, ListToolbar } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { CategoriesTable } from "./CategoriesTable";
import { CATEGORY_PAGE_SIZES } from "./category-page-sizes";
import { CategoryBulkActions } from "./CategoryBulkActions";

type CategoriesScreenProps = {
  /** One page of categories plus the matching total. */
  categories: Page<Category>;
  /** The filters this page was fetched with, to distinguish "no categories" from "no matches". */
  filters: AdminCategoryFilters;
};

/**
 * Admin categories list. Presentational: the dashboard page fetches over the REST
 * API (BFF) during server render and passes the page in. Search and status filters
 * live in the URL, so changing either re-runs this server render — and mutations
 * still call `router.refresh()` (see DeleteCategoryButton). Either way the server
 * stays the single source of truth — no client-side data cache to keep in sync.
 */
export async function CategoriesScreen({ categories, filters }: CategoriesScreenProps) {
  const t = await getTranslations("dashCategories");
  const tList = await getTranslations("dashList");
  const isFiltered = filters.query != null || filters.status != null;
  const statusLabels: Record<(typeof ADMIN_CATEGORY_STATUSES)[number], string> = {
    active: t("filterStatusActive"),
    inactive: t("filterStatusInactive"),
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="mt-1 text-body-small text-muted-foreground">{t("count", { count: categories.total })}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/dashboard/categories/create">
            <Icon icon={Plus} size="sm" className="me-1.5" />
            {t("newCategory")}
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-card-lg border border-border bg-background shadow-sm">
        <ListToolbar
          className="border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          search={
            <ListSearchInput
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              className="sm:max-w-sm [&_input]:h-11 sm:[&_input]:h-10"
            />
          }
          filters={
            <ListFilterSelect
              className="h-11 w-full sm:h-10 sm:w-auto"
              paramName="status"
              label={t("filterStatusLabel")}
              options={[
                { value: "", label: t("filterStatusOption", { status: t("filterStatusAll") }) },
                ...ADMIN_CATEGORY_STATUSES.map((status) => ({
                  value: status,
                  label: t("filterStatusOption", { status: statusLabels[status] }),
                })),
              ]}
            />
          }
        />

        {categories.items.length > 0 ? (
          // The provider wraps both the bar and the table so a row's checkbox and
          // the actions above it share one selection. The rows stay server-
          // rendered inside it — only the checkboxes and the bar are client islands.
          <BulkSelectionProvider ids={categories.items.map((category) => category.id)}>
            <div className="[&:has(>div)]:border-b [&:has(>div)]:border-border [&:has(>div)]:p-4">
              <BulkActionBar>
                <CategoryBulkActions />
              </BulkActionBar>
            </div>
            <CategoriesTable
              categories={categories.items}
              footer={
                <ListPager
                  page={categories}
                  defaultPageSize={CATEGORY_PAGE_SIZES.defaultPageSize}
                  pageSizeOptions={CATEGORY_PAGE_SIZES.options}
                />
              }
            />
          </BulkSelectionProvider>
        ) : (
          <EmptyState
            icon={isFiltered ? Search : FolderTree}
            title={isFiltered ? tList("noResultsTitle") : t("emptyTitle")}
            description={isFiltered ? tList("noResultsBody") : t("emptyBody")}
            action={
              isFiltered ? undefined : (
                <Button asChild size="sm">
                  <Link href="/dashboard/categories/create">
                    <Icon icon={Plus} size="sm" className="me-1.5" />
                    {t("newCategory")}
                  </Link>
                </Button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}
