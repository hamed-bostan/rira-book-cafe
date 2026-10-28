import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import type { Page } from "@/src/domain/entities/Pagination";
import type { ProductListItem } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { ListChoiceFilter, ListPager, ListSearchInput } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { MENU_ITEM_SHOWS, type MenuItemShow } from "./menu-item-show";
import { PRODUCT_ROW_GRID, ProductRow } from "./ProductRow";

type ProductsScreenProps = {
  /** One page of items plus the total behind it. */
  products: Page<ProductListItem>;
  /** Every category, each with its item count — the tabs. */
  categories: Category[];
  /** The category tab on screen; `undefined` is "All". */
  categoryId: string | undefined;
  show: MenuItemShow | undefined;
  /** The search, when one is applied — to tell "nothing here" from "no matches". */
  query: string | undefined;
  /**
   * Items low or out of stock across the whole menu — a made-to-order one by an
   * ingredient of its recipe — for the "need attention" link.
   */
  attention: number;
  /**
   * Whether the viewer may change the catalog. Decides which controls are drawn —
   * the list itself is readable by anyone with dashboard access. Presentation only:
   * the endpoints behind every control check for themselves.
   */
  canWrite: boolean;
};

type ListState = { categoryId?: string; show?: MenuItemShow; query?: string };

/** The menu list's URL for a tab, view and search — always page 1. */
function hrefFor({ categoryId, show, query }: ListState): string {
  const params = new URLSearchParams();
  if (categoryId) params.set("categoryId", categoryId);
  if (show) params.set("show", show);
  if (query) params.set("q", query);
  const qs = params.toString();
  return qs ? `/dashboard/products?${qs}` : "/dashboard/products";
}

/**
 * Menu items: what guests can order and what shows on the menu. A tab per
 * category with its count, a search and a "Show" filter (everything, low or out
 * of stock, hidden from the menu); each row has the price (and what it was, on
 * offer), the stock level, an "On menu" switch and Edit / Feature / Delete.
 *
 * Presentational: the page fetches one page over the REST API (BFF) during server
 * render. Tabs, search and filter all live in the URL; every change a row makes
 * `router.refresh()`es. There's no client-side copy of the list.
 */
export async function ProductsScreen({
  products,
  categories,
  categoryId,
  show,
  query,
  attention,
  canWrite,
}: ProductsScreenProps) {
  const t = await getTranslations("dashProducts");
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const isFiltered = show != null || query != null;
  const totalItems = categories.reduce((sum, category) => sum + category.productCount, 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-body-default text-muted-foreground sm:text-body-small">
            <span>{t("subtitle")}</span>
            {attention > 0 ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={hrefFor({ show: "attention" })}
                  // 44px to the touch on a phone without moving the line.
                  className={cn(
                    "-my-3 py-3 font-semibold text-error-foreground underline underline-offset-4 sm:my-0 sm:py-0",
                    focusRing,
                  )}
                >
                  {t("attentionLink", { count: attention })}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canWrite ? (
          <Button size="control-md" asChild className="gap-2 px-4">
            <Link href="/dashboard/products/create">
              <Icon icon={Plus} size="icon-md" />
              {t("newProduct")}
            </Link>
          </Button>
        ) : null}
      </div>

      <section
        aria-label={t("listLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <DashboardLinkTabs
          className="px-4"
          label={t("categoryTabsLabel")}
          current={categoryId ?? ""}
          tabs={[
            { key: "", label: t("tabAll"), count: totalItems, href: hrefFor({ show, query }) },
            ...categories.map((category) => ({
              key: category.id,
              label: category.name,
              count: category.productCount,
              href: hrefFor({ categoryId: category.id, show, query }),
            })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <ListSearchInput
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="max-w-md min-w-0 flex-[1_1_15rem]"
          />
          <ListChoiceFilter
            paramName="show"
            label={t("showLabel")}
            allLabel={t("show.all")}
            showAllValue
            options={MENU_ITEM_SHOWS.map((value) => ({ value, label: t(`show.${value}`) }))}
          />
        </div>

        {products.items.length > 0 ? (
          <>
            <div
              aria-hidden
              className={cn(
                "hidden h-10 items-center border-b border-border bg-muted px-5 text-body-caption font-semibold tracking-wider text-muted-foreground uppercase md:grid",
                PRODUCT_ROW_GRID,
              )}
            >
              <span>{t("colProduct")}</span>
              <span className="text-end">{t("colPrice")}</span>
              <span>{t("colStock")}</span>
              <span>{t("colOnMenu")}</span>
              <span />
            </div>
            <ul>
              {products.items.map((product, index) => (
                <li key={product.id} className={cn(index > 0 && "border-t border-border")}>
                  <ProductRow
                    product={product}
                    // On a category's own tab the category goes without saying.
                    categoryName={categoryId ? undefined : categoryNames.get(product.categoryId)}
                    canWrite={canWrite}
                  />
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3">
              <ListPager page={products} />
            </div>
          </>
        ) : isFiltered ? (
          <DashboardEmptyState title={t("noMatchesTitle")} body={query ? t("noMatchesSearch") : t("noMatchesView")} />
        ) : (
          <DashboardEmptyState title={t("listEmptyTitle")} body={t("listEmptyBody")} />
        )}
      </section>
    </div>
  );
}
