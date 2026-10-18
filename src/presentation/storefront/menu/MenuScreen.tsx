import { Coffee, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import { pageCount } from "@/src/domain/entities/Pagination";
import { PRODUCT_KINDS, type Product, type ProductKind } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { MenuItemCard } from "./MenuItemCard";
import { MenuPager } from "./MenuPager";

/** Items per menu page: six rows of the four-column grid, twelve of the two-column phone grid. */
export const MENU_PAGE_SIZE = 24;

/** Cards whose photo is preloaded — the first row on a phone, where the largest paint usually is. */
const PRELOADED_CARDS = 2;

type MenuScreenProps = {
  categories: Category[];
  items: Product[];
  /** The filters the page was opened with. */
  categoryId?: string;
  kind?: ProductKind;
  /** 1-based page from `?page=`; out-of-range values are clamped. */
  page?: number;
};

/**
 * The public menu: drinks, food and books, filterable by type and category.
 * Filters are links, so a filtered menu ("just the books") can be shared.
 * Items in a hidden category are left out.
 */
export async function MenuScreen({ categories, items, categoryId, kind, page: requestedPage = 1 }: MenuScreenProps) {
  const t = await getTranslations("site");
  const tProducts = await getTranslations("dashProducts");

  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const visible = items.filter(
    (item) =>
      activeCategoryIds.has(item.categoryId) &&
      (!categoryId || item.categoryId === categoryId) &&
      (!kind || item.kind === kind),
  );
  const page = Math.min(Math.max(1, requestedPage), pageCount(visible.length, MENU_PAGE_SIZE));
  const onPage = visible.slice((page - 1) * MENU_PAGE_SIZE, page * MENU_PAGE_SIZE);
  // Empty because of the filters (the unfiltered menu has something), not because the menu is.
  const isFiltered = Boolean(kind || categoryId) && items.some((item) => activeCategoryIds.has(item.categoryId));
  // Categories worth offering: ones with something of the chosen type in them.
  const offered = categories.filter((category) =>
    items.some((item) => item.categoryId === category.id && (!kind || item.kind === kind)),
  );

  // A filter link starts over at page 1; only the pager carries a page.
  function href(next: { categoryId?: string; kind?: ProductKind; page?: number }): string {
    const params = new URLSearchParams();
    if (next.kind) params.set("kind", next.kind);
    if (next.categoryId) params.set("category", next.categoryId);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    return qs ? `/menu?${qs}` : "/menu";
  }

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-4 py-2 text-body-small-emphasis transition-colors",
      focusRing,
      active ? "border-primary bg-accent text-primary" : "border-border text-foreground hover:bg-muted",
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-heading-page text-foreground">{t("menu.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("menu.subtitle")}</p>
      </div>

      <nav aria-label={t("menu.kindFilter")} className="scrollbar-hide flex gap-2 overflow-x-auto">
        <Link href={href({ categoryId })} aria-current={!kind ? "true" : undefined} className={chip(!kind)}>
          {t("menu.all")}
        </Link>
        {PRODUCT_KINDS.map((option) => (
          <Link
            key={option}
            href={href({ kind: option })}
            aria-current={kind === option ? "true" : undefined}
            className={chip(kind === option)}
          >
            {tProducts(`kind.${option}`)}
          </Link>
        ))}
      </nav>

      {offered.length > 1 ? (
        <nav aria-label={t("menu.categoryFilter")} className="scrollbar-hide -mt-2 flex gap-2 overflow-x-auto">
          <Link href={href({ kind })} aria-current={!categoryId ? "true" : undefined} className={chip(!categoryId)}>
            {t("menu.allCategories")}
          </Link>
          {offered.map((category) => (
            <Link
              key={category.id}
              href={href({ kind, categoryId: category.id })}
              aria-current={categoryId === category.id ? "true" : undefined}
              className={chip(categoryId === category.id)}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {visible.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {onPage.map((item, index) => (
              <MenuItemCard key={item.id} item={item} preload={index < PRELOADED_CARDS} />
            ))}
          </div>
          <MenuPager
            page={page}
            pageSize={MENU_PAGE_SIZE}
            total={visible.length}
            href={(target) => href({ kind, categoryId, page: target })}
          />
        </>
      ) : (
        <EmptyState
          icon={isFiltered ? SearchX : Coffee}
          title={isFiltered ? t("menu.noResults") : t("menu.empty")}
          action={
            isFiltered ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/menu">{t("menu.clearFilters")}</Link>
              </Button>
            ) : undefined
          }
          className="rounded-card-lg border border-dashed border-border"
        />
      )}
    </div>
  );
}
