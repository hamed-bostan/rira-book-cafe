import { getLocale, getTranslations } from "next-intl/server";

import type { Product } from "@/src/domain/entities/Product";
import { getStockStatus } from "@/src/domain/entities/stock";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { ProductThumbnail } from "@/src/presentation/dashboard/ProductThumbnail";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { ProductOnMenuSwitch } from "./ProductOnMenuSwitch";
import { ProductRowActions } from "./ProductRowActions";

/**
 * The list's columns from `md` up — item, price, stock, on menu, actions — shared
 * with the header row so the two line up.
 */
export const PRODUCT_ROW_GRID = "gap-x-4 md:grid-cols-[minmax(0,1fr)_8rem_10rem_7rem_2.5rem]";

type ProductRowProps = {
  product: Product;
  /** Shown under the name on the "All" tab; omitted on a category's own tab. */
  categoryName: string | undefined;
  canWrite: boolean;
};

/**
 * One menu item. From `md` up it's a row of the list's columns; below that the
 * price, stock and switch wrap under the name, lined up with it, and the ⋯ menu
 * stays beside the name.
 */
export async function ProductRow({ product, categoryName, canWrite }: ProductRowProps) {
  const t = await getTranslations("dashProducts");
  const locale = await getLocale();

  const stock = getStockStatus(product.stockQuantity);
  const sub = [categoryName, product.book?.author, product.unit].filter(Boolean).join(" · ");

  return (
    <article
      aria-label={product.name}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-y-3 px-5 py-3", PRODUCT_ROW_GRID)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ProductThumbnail src={product.imageUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-body-strong break-words sm:text-body-small-strong",
                product.isPublished ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {product.name}
            </span>
            {product.isFeatured ? (
              <Badge variant="info" appearance="outline" dot>
                {t("featuredBadge")}
              </Badge>
            ) : null}
          </div>
          {sub ? <span className="text-body-small text-muted-foreground sm:text-body-caption">{sub}</span> : null}
        </div>
      </div>

      {/* Below `md` this wraps under the name, indented past the picture; from
          `md` up it dissolves so its three cells are the row's own columns. */}
      <div className="order-1 col-span-full flex flex-wrap items-center gap-x-5 gap-y-2 ps-13 md:contents">
        <div className="flex flex-col whitespace-nowrap tabular-nums md:text-end">
          <span className="text-body-strong text-foreground sm:text-body-small-strong">
            {formatMoney(product.price, locale)}
          </span>
          {product.originalPrice != null ? (
            <span className="text-body-small text-muted-foreground line-through sm:text-body-caption">
              {formatMoney(product.originalPrice, locale)}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center">
          {stock.level === "out" ? (
            <Badge variant="error" appearance="outline" dot>
              {t("stockOut")}
            </Badge>
          ) : stock.level === "low" ? (
            <Badge variant="warning" appearance="outline" dot>
              {t("stockLow", { count: stock.quantity })}
            </Badge>
          ) : (
            <Badge variant="success" appearance="outline" dot>
              {t("stockIn", { count: stock.quantity })}
            </Badge>
          )}
        </div>
        <div className="flex">
          {canWrite ? (
            <ProductOnMenuSwitch id={product.id} name={product.name} isPublished={product.isPublished} />
          ) : (
            <span className="text-body-default text-foreground/80 sm:text-body-small">
              {product.isPublished ? t("onMenu") : t("hidden")}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end md:order-1">
        {canWrite ? <ProductRowActions id={product.id} name={product.name} isFeatured={product.isFeatured} /> : null}
      </div>
    </article>
  );
}
