"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { DEFAULT_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS, pageCount, type Page } from "@/src/domain/entities/Pagination";
import { mergePageParams } from "@/src/lib/api/pagination-params";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { writePageSizeCookie } from "./pageSizeCookie";
import { useListParams } from "./useListParams";

type ListPagerProps = {
  /** The page currently rendered — supplies the counts, so they can't disagree with the rows. */
  page: Pick<Page<unknown>, "total" | "page" | "pageSize">;
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  /** Borderless, space-efficient treatment used by compact responsive tables. */
  compact?: boolean;
};

/**
 * Page controls for an admin list: which rows are on screen, out of how many, and
 * the way to the next slice. The chosen size is remembered in a cookie, which the
 * list pages read before fetching (`withRememberedPageSize`).
 *
 * Previous/next only, no numbered pages: the tables are sorted and filtered to
 * find rows, not browsed by ordinal, and jumping to "page 34" of a list you can
 * search is rarely what anyone wants. A jump-to-page control can be added here if
 * that turns out to be wrong.
 */
export function ListPager({
  page,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
  compact = false,
}: ListPagerProps) {
  const { searchParams, setParams } = useListParams();
  const t = useTranslations("dashList");
  const locale = useLocale();
  const pageSizeId = useId();

  const totalPages = pageCount(page.total, page.pageSize);

  const first = (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.total, page.page * page.pageSize);

  function goTo(next: number): void {
    setParams(mergePageParams(searchParams, { page: next }, { pageSize: defaultPageSize }));
  }

  function changePageSize(pageSize: number): void {
    writePageSizeCookie(pageSize);
    const next = mergePageParams(searchParams, { page: 1 }, { pageSize: defaultPageSize });
    // Named in the URL even when it's the default: the list page fills a missing
    // size from the cookie, and the client router may still hold this URL rendered
    // under the old one — an explicit size is a different URL, so it can't be reused.
    next.set("pageSize", String(pageSize));
    setParams(next);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={pageSizeId}
          className={
            compact
              ? "text-body-default text-muted-foreground dashboard-phone:text-body-small"
              : "text-body-small-strong text-muted-foreground"
          }
        >
          {t("rowsPerPage")}
        </label>
        <Select
          id={pageSizeId}
          size="sm"
          value={page.pageSize}
          onChange={(event) => changePageSize(Number(event.target.value))}
          className={
            compact
              ? "h-auto w-auto appearance-none border-transparent bg-transparent p-0 text-body-small"
              : "h-11 w-auto sm:h-10"
          }
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {formatNumber(size, locale)}
            </option>
          ))}
        </Select>
      </div>

      <div className="ms-auto flex max-w-full flex-wrap items-center justify-end gap-2">
        <p
          className={
            compact
              ? "text-body-default text-muted-foreground dashboard-phone:text-body-small"
              : "text-body-small-strong text-muted-foreground"
          }
        >
          {t("range", {
            first: formatNumber(first, locale),
            last: formatNumber(last, locale),
            total: formatNumber(page.total, locale),
          })}
        </p>
        {totalPages > 1 && (
          <>
            <p className="text-body-small-strong text-muted-foreground">
              {t("pageOf", {
                page: formatNumber(page.page, locale),
                pages: formatNumber(totalPages, locale),
              })}
            </p>
            {/* The chevrons point at previous/next in reading order, so they mirror
            under RTL — `ms/me` logic isn't enough for a glyph that has a
            direction of its own. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goTo(page.page - 1)}
              disabled={page.page <= 1}
              aria-label={t("previous")}
              className="size-11"
            >
              <Icon icon={ChevronLeft} size="sm" className="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goTo(page.page + 1)}
              disabled={page.page >= totalPages}
              aria-label={t("next")}
              className="size-11"
            >
              <Icon icon={ChevronRight} size="sm" className="rtl:rotate-180" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
