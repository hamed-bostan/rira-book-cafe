import { getLocale, getTranslations } from "next-intl/server";

import {
  DEFAULT_ADMIN_PRODUCT_DIRECTION,
  DEFAULT_ADMIN_PRODUCT_SORT,
} from "@/src/domain/entities/AdminProductFilters";
import type { Product } from "@/src/domain/entities/Product";
import { getStockStatus } from "@/src/domain/entities/stock";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { BulkRowCheckbox, BulkSelectAllCheckbox } from "@/src/presentation/dashboard/bulk";
import { ListSortHeader, ListSortSelect } from "@/src/presentation/dashboard/list";
import { ProductThumbnail } from "@/src/presentation/dashboard/ProductThumbnail";
import {
  Badge,
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/presentation/design-system";

import { ProductRowActions } from "./ProductRowActions";

import type { ReactNode } from "react";

type ProductsTableProps = {
  products: Product[];
  /** Category id to localized display name. */
  categoryNames: Map<string, string>;
  canWrite: boolean;
  /** Search and filters attached to the table's upper edge. */
  toolbar?: ReactNode;
  /** Content shown inside the shared frame when the current query has no rows. */
  emptyState?: ReactNode;
  footer?: ReactNode;
};

const SORT_DEFAULTS = {
  defaultSort: DEFAULT_ADMIN_PRODUCT_SORT,
  defaultDirection: DEFAULT_ADMIN_PRODUCT_DIRECTION,
} as const;

/** Product management list with explicit inventory and publication state. */
export async function ProductsTable({ products, categoryNames, canWrite, toolbar, emptyState, footer }: ProductsTableProps) {
  const t = await getTranslations("dashProducts");
  const locale = await getLocale();

  return (
    <DataTable className="min-w-0 bg-background" toolbar={toolbar} footer={products.length > 0 ? footer : undefined}>
      {products.length > 0 ? (
        <>
      <div className="@4xl/products:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/50 p-4 [&_select]:h-11 [&_select]:w-full [&_select]:min-w-0">
          {canWrite ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-small-strong text-muted-foreground">
              <BulkSelectAllCheckbox label={t("selectAllAria")} />
              {t("selectAllAria")}
            </label>
          ) : null}
          <div className="w-full min-w-0 @sm/products:w-auto">
            <ListSortSelect
              label={t("sortLabel")}
              {...SORT_DEFAULTS}
              options={[
                { sort: "createdAt", direction: "desc", label: t("sortNewest") },
                { sort: "createdAt", direction: "asc", label: t("sortOldest") },
                { sort: "name", direction: "asc", label: t("sortNameAsc") },
                { sort: "name", direction: "desc", label: t("sortNameDesc") },
                { sort: "price", direction: "asc", label: t("sortPriceAsc") },
                { sort: "price", direction: "desc", label: t("sortPriceDesc") },
                { sort: "stock", direction: "asc", label: t("sortStockAsc") },
                { sort: "stock", direction: "desc", label: t("sortStockDesc") },
              ]}
            />
          </div>
        </div>
        <ul className="divide-y divide-border">
          {products.map((product) => {
            const stock = getStockStatus(product.stockQuantity);
            const categoryName = categoryNames.get(product.categoryId);
            return (
              <li key={product.id} className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <ProductThumbnail src={product.imageUrl} size="card" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-body-small-strong text-foreground">{product.name}</p>
                    <p className="mt-1 text-body-caption text-muted-foreground">
                      {t(`kind.${product.kind}`)}
                      {product.book ? ` · ${product.book.author}` : null}
                    </p>
                    {product.unit ? <p className="mt-1 break-words text-body-caption text-muted-foreground">{product.unit}</p> : null}
                    {categoryName ? (
                      <Link href={`/dashboard/products?categoryId=${encodeURIComponent(product.categoryId)}`} className="mt-1 inline-block break-words text-body-small-strong text-primary underline-offset-4 hover:underline">
                        {categoryName}
                      </Link>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <ProductRowActions id={product.id} name={product.name} />
                      <label className="flex size-11 cursor-pointer items-center justify-center">
                        <BulkRowCheckbox id={product.id} label={t("selectRowAria", { name: product.name })} />
                      </label>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-3">
                  <div className="min-w-0">
                    <p className="mb-1 text-body-caption text-muted-foreground">{t("colPrice")}</p>
                    <p className="break-words text-body-small-emphasis tabular-nums text-foreground">{formatMoney(product.price, locale)}</p>
                    {product.originalPrice != null ? <p className="text-body-caption text-muted-foreground line-through">{formatMoney(product.originalPrice, locale)}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={stock.level === "out" ? "destructive" : stock.level === "low" ? "warning" : "success"}>
                      {t(stock.level === "out" ? "outOfStockCount" : stock.level === "low" ? "lowStock" : "inStock", { count: formatNumber(stock.level === "out" ? 0 : stock.quantity, locale) })}
                    </Badge>
                    <Badge variant={product.isPublished ? "success" : "neutral"}>{product.isPublished ? t("publishedBadge") : t("unpublishedBadge")}</Badge>
                    {product.isFeatured ? <Badge variant="success">{t("featuredBadge")}</Badge> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden overflow-x-auto @4xl/products:block">
        <Table>
          <caption className="sr-only">{t("heading")}</caption>
          <TableHeader>
            <tr>
              {canWrite ? (
                <TableHead className="w-10">
                  <label className="flex size-8 cursor-pointer items-center justify-center">
                    <BulkSelectAllCheckbox label={t("selectAllAria")} />
                  </label>
                </TableHead>
              ) : null}
              <ListSortHeader className="text-start" sortKey="name" {...SORT_DEFAULTS}>
                {t("colProduct")}
              </ListSortHeader>
              <TableHead className="text-start">{t("colCategory")}</TableHead>
              <ListSortHeader sortKey="price" align="end" initialDirection="desc" {...SORT_DEFAULTS}>
                {t("colPrice")}
              </ListSortHeader>
              <ListSortHeader className="text-start" sortKey="stock" initialDirection="asc" {...SORT_DEFAULTS}>
                {t("colInventory")}
              </ListSortHeader>
              <TableHead className="text-start">{t("colVisibility")}</TableHead>
              {canWrite ? <TableHead className="text-end">{t("colActions")}</TableHead> : null}
            </tr>
          </TableHeader>

          <TableBody>
            {products.map((product) => {
              const stock = getStockStatus(product.stockQuantity);
              const categoryName = categoryNames.get(product.categoryId);

              return (
                <TableRow key={product.id}>
                  {canWrite ? (
                    <TableCell>
                      <label className="flex size-8 cursor-pointer items-center justify-center">
                        <BulkRowCheckbox id={product.id} label={t("selectRowAria", { name: product.name })} />
                      </label>
                    </TableCell>
                  ) : null}

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductThumbnail src={product.imageUrl} size="table" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="max-w-64 break-words text-body-small-strong text-foreground">{product.name}</span>
                          {product.isFeatured ? <Badge variant="success">{t("featuredBadge")}</Badge> : null}
                        </div>
                        <span className="block truncate text-body-caption text-muted-foreground">
                          {t(`kind.${product.kind}`)}
                          {product.book ? ` · ${product.book.author}` : null}
                        </span>
                        {product.unit ? (
                          <span className="block truncate text-body-caption text-muted-foreground">{product.unit}</span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-body-small">
                    {categoryName ? (
                      <Link
                        href={`/dashboard/products?categoryId=${encodeURIComponent(product.categoryId)}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {categoryName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-end">
                    <span className="text-body-small-emphasis text-foreground">{formatMoney(product.price, locale)}</span>
                    {product.originalPrice != null ? (
                      <span className="block text-body-caption text-muted-foreground line-through">
                        {formatMoney(product.originalPrice, locale)}
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    {stock.level === "out" ? (
                      <Badge variant="destructive">{t("outOfStockCount", { count: formatNumber(0, locale) })}</Badge>
                    ) : stock.level === "low" ? (
                      <Badge variant="warning">{t("lowStock", { count: formatNumber(stock.quantity, locale) })}</Badge>
                    ) : (
                      <Badge variant="success">{t("inStock", { count: formatNumber(stock.quantity, locale) })}</Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant={product.isPublished ? "success" : "neutral"}>
                      {product.isPublished ? t("publishedBadge") : t("unpublishedBadge")}
                    </Badge>
                  </TableCell>

                  {canWrite ? (
                    <TableCell>
                      <div className="flex justify-end">
                        <ProductRowActions
                          id={product.id}
                          name={product.name}
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
        </>
      ) : (
        emptyState
      )}
    </DataTable>
  );
}
