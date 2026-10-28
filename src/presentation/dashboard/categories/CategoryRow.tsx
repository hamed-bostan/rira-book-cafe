import { getLocale, getTranslations } from "next-intl/server";

import type { Category } from "@/src/domain/entities/Category";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { CategoryRowActions } from "./CategoryRowActions";

type CategoryRowProps = {
  category: Category;
  /** Its place on the menu, counted from one. */
  position: number;
  isFirst: boolean;
  isLast: boolean;
};

/**
 * One category: its place on the menu, icon and name (which opens Menu items on
 * that category), a "Hidden from menu" badge when guests can't see it, how many
 * items it holds and how many of those are hidden — and the controls to move it,
 * edit, hide or delete it.
 */
export async function CategoryRow({ category, position, isFirst, isLast }: CategoryRowProps) {
  const t = await getTranslations("dashCategories");
  const locale = await getLocale();

  const { productCount, hiddenProductCount } = category;
  const summary =
    productCount === 0
      ? t("noItems")
      : [
          t("itemCount", { count: productCount, formatted: formatNumber(productCount, locale) }),
          hiddenProductCount > 0 ? t("hiddenCount", { formatted: formatNumber(hiddenProductCount, locale) }) : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <article
      aria-label={t("rowAria", { position: formatNumber(position, locale), name: category.name })}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 text-body-default sm:text-body-small"
    >
      <span aria-hidden className="w-5 shrink-0 text-end text-muted-foreground tabular-nums">
        {formatNumber(position, locale)}
      </span>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-button bg-muted">
        <FadeInImage src={category.iconUrl} alt="" width={24} height={24} className="size-6 object-contain" />
      </span>
      <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/dashboard/products?categoryId=${encodeURIComponent(category.id)}`}
            // 44px to the touch on a phone without moving the line.
            className={cn(
              "-my-3 py-3 font-semibold transition-colors hover:text-primary sm:my-0 sm:py-0",
              category.isActive ? "text-foreground" : "text-muted-foreground",
              focusRing,
            )}
          >
            {category.name}
          </Link>
          {category.isActive ? null : (
            <Badge variant="neutral" appearance="outline" size="compact" dot>
              {t("hiddenBadge")}
            </Badge>
          )}
        </div>
        <span className="text-body-small text-muted-foreground sm:text-body-caption">{summary}</span>
      </div>
      <CategoryRowActions
        category={{
          id: category.id,
          name: category.name,
          isActive: category.isActive,
          productCount: category.productCount,
        }}
        isFirst={isFirst}
        isLast={isLast}
      />
    </article>
  );
}
