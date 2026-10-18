import { getLocale, getTranslations } from "next-intl/server";

import {
  DEFAULT_ADMIN_CATEGORY_DIRECTION,
  DEFAULT_ADMIN_CATEGORY_SORT,
} from "@/src/domain/entities/AdminCategoryFilters";
import type { Category } from "@/src/domain/entities/Category";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { BulkRowCheckbox, BulkSelectAllCheckbox } from "@/src/presentation/dashboard/bulk";
import { ListSortHeader } from "@/src/presentation/dashboard/list";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/presentation/design-system/components/DataTable/DataTable";
import { Thumbnail } from "@/src/presentation/design-system/components/Thumbnail/Thumbnail";

import { CategoryMobileSort } from "./CategoryMobileSort";
import { CategoryRowActions } from "./CategoryRowActions";

import type { ReactNode } from "react";

type CategoriesTableProps = {
  categories: Category[];
  footer?: ReactNode;
};

/**
 * The list's own default ordering, passed to every sortable header so an
 * untouched table leaves `sort`/`dir` out of the URL entirely.
 */
const SORT_DEFAULTS = {
  defaultSort: DEFAULT_ADMIN_CATEGORY_SORT,
  defaultDirection: DEFAULT_ADMIN_CATEGORY_DIRECTION,
} as const;

/** Admin category list optimized for scanning, with secondary details grouped by category. */
export async function CategoriesTable({ categories, footer }: CategoriesTableProps) {
  const t = await getTranslations("dashCategories");
  const locale = await getLocale();

  return (
    <DataTable
      footer={footer}
      className="@container min-w-0 rounded-none border-0 [&>div:last-child>div>div:last-child]:flex-wrap"
    >
      <div className="@[48rem]:hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-sunken/50 px-4 py-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-small-strong text-muted-foreground">
            <BulkSelectAllCheckbox label={t("selectAllAria")} />
            {t("selectAllShort")}
          </label>
          <CategoryMobileSort />
        </div>
        <ul className="divide-y divide-border" aria-label={t("heading")}>
          {categories.map((category) => (
            <li key={category.id} className="min-w-0 p-4 has-[[data-state=checked]]:bg-accent/40">
              <div className="flex min-w-0 items-start gap-2">
                <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                  <BulkRowCheckbox id={category.id} label={t("selectRowAria", { name: category.name })} />
                </label>
                <Thumbnail className="size-12 border border-border/60">
                  <FadeInImage src={category.iconUrl} alt="" width={36} height={36} className="object-contain" />
                </Thumbnail>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/categories/${category.id}/edit`}
                    className="block rounded-sm text-body-bold break-words text-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {category.name}
                  </Link>
                  <p className="mt-1 text-body-small break-all text-muted-foreground">{category.slug}</p>
                </div>
                <CategoryRowActions id={category.id} name={category.name} productCount={category.productCount} />
              </div>
              <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 rounded-card-md bg-surface-sunken/50 p-3">
                <div className="min-w-0">
                  <dt className="mb-1 text-body-small-emphasis text-muted-foreground">{t("colProductCount")}</dt>
                  <dd>
                    <Link
                      href={`/dashboard/products?categoryId=${encodeURIComponent(category.id)}`}
                      aria-label={t("viewProductsAria", { name: category.name, count: category.productCount })}
                      className="inline-flex min-h-11 min-w-11 items-center rounded-sm text-body-bold text-primary tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {formatNumber(category.productCount, locale)}
                    </Link>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="mb-1 text-body-small-emphasis text-muted-foreground">{t("colStatus")}</dt>
                  <dd className="flex min-h-11 items-center">
                    <Badge variant={category.isActive ? "success" : "neutral"} className="gap-1.5">
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
                      {category.isActive ? t("statusActive") : t("statusInactive")}
                    </Badge>
                  </dd>
                </div>
                <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-body-small-emphasis text-muted-foreground">
                  <dt>{t("colUpdatedAt")}</dt>
                  <dd>
                    <time dateTime={category.updatedAt.toISOString()}>
                      {formatOrderDateShort(category.updatedAt.toISOString(), locale)}
                    </time>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
      <Table className="hidden table-fixed @[48rem]:table [&_td]:py-4 [&_td:first-child]:ps-5 [&_td:last-child]:pe-5 [&_th]:whitespace-nowrap [&_th:first-child]:ps-5 [&_th:last-child]:pe-5">
        <TableHeader>
          <tr>
            <TableHead className="w-10">
              <BulkSelectAllCheckbox label={t("selectAllAria")} />
            </TableHead>
            <ListSortHeader className="w-[32%] text-start" sortKey="name" {...SORT_DEFAULTS}>
              {t("colCategory")}
            </ListSortHeader>
            <ListSortHeader sortKey="productCount" align="end" initialDirection="desc" {...SORT_DEFAULTS}>
              {t("colProductCount")}
            </ListSortHeader>
            <TableHead className="text-start">{t("colStatus")}</TableHead>
            <ListSortHeader className="text-start" sortKey="updatedAt" initialDirection="desc" {...SORT_DEFAULTS}>
              {t("colUpdatedAt")}
            </ListSortHeader>
            <TableHead className="text-end">{t("colActions")}</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell>
                <BulkRowCheckbox id={category.id} label={t("selectRowAria", { name: category.name })} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Thumbnail className="size-12 border border-border/60">
                    <FadeInImage src={category.iconUrl} alt="" width={36} height={36} className="object-contain" />
                  </Thumbnail>
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/categories/${category.id}/edit`}
                      className="block max-w-64 truncate rounded-sm text-body-bold text-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {category.name}
                    </Link>
                    <p className="mt-1 max-w-64 truncate text-body-small text-muted-foreground">{category.slug}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-end text-body-small">
                <Link
                  href={`/dashboard/products?categoryId=${encodeURIComponent(category.id)}`}
                  className="inline-flex min-w-10 items-center justify-center rounded-card-md border border-border bg-surface-sunken px-2.5 py-1 text-body-small-emphasis text-foreground tabular-nums transition-colors hover:border-primary/30 hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={t("viewProductsAria", { name: category.name, count: category.productCount })}
                >
                  {formatNumber(category.productCount, locale)}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={category.isActive ? "success" : "neutral"} className="gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  {category.isActive ? t("statusActive") : t("statusInactive")}
                </Badge>
              </TableCell>
              <TableCell className="text-body-small-strong whitespace-nowrap text-muted-foreground">
                {formatOrderDateShort(category.updatedAt.toISOString(), locale)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <CategoryRowActions id={category.id} name={category.name} productCount={category.productCount} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTable>
  );
}
