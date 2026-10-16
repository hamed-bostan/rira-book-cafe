import { getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import { PRODUCT_KINDS, type Product, type ProductKind } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system";

import { MenuItemCard } from "./MenuItemCard";

type MenuScreenProps = {
  categories: Category[];
  items: Product[];
  /** The filters the page was opened with. */
  categoryId?: string;
  kind?: ProductKind;
};

/**
 * The public menu: drinks, food and books, filterable by type and category.
 * Filters are links, so a filtered menu ("just the books") can be shared.
 * Items in a hidden category are left out.
 */
export async function MenuScreen({ categories, items, categoryId, kind }: MenuScreenProps) {
  const t = await getTranslations("site");
  const tProducts = await getTranslations("dashProducts");

  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const visible = items.filter(
    (item) =>
      activeCategoryIds.has(item.categoryId) &&
      (!categoryId || item.categoryId === categoryId) &&
      (!kind || item.kind === kind),
  );
  // Categories worth offering: ones with something of the chosen type in them.
  const offered = categories.filter((category) =>
    items.some((item) => item.categoryId === category.id && (!kind || item.kind === kind)),
  );

  function href(next: { categoryId?: string; kind?: ProductKind }): string {
    const params = new URLSearchParams();
    if (next.kind) params.set("kind", next.kind);
    if (next.categoryId) params.set("category", next.categoryId);
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

      <nav aria-label={t("menu.kindFilter")} className="flex gap-2 overflow-x-auto scrollbar-hide">
        <Link href={href({ categoryId })} aria-current={!kind ? "true" : undefined} className={chip(!kind)}>
          {t("menu.all")}
        </Link>
        {PRODUCT_KINDS.map((option) => (
          <Link key={option} href={href({ kind: option })} aria-current={kind === option ? "true" : undefined} className={chip(kind === option)}>
            {tProducts(`kind.${option}`)}
          </Link>
        ))}
      </nav>

      {offered.length > 1 ? (
        <nav aria-label={t("menu.categoryFilter")} className="-mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="rounded-card-lg border border-dashed border-border px-6 py-16 text-center text-body-small text-muted-foreground">
          {t("menu.empty")}
        </p>
      )}
    </div>
  );
}
