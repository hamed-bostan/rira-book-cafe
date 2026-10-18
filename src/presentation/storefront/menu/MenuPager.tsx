import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { pageCount } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

type MenuPagerProps = {
  page: number;
  pageSize: number;
  total: number;
  /** The menu URL for a page, with the current filters kept. */
  href: (page: number) => string;
};

/**
 * Previous/next links under the menu grid, plus where you are ("25–48 of 70").
 * Plain links, like the filters above the grid: every page is server-rendered,
 * shareable and works without JavaScript. Renders nothing for a single page.
 */
export async function MenuPager({ page, pageSize, total, href }: MenuPagerProps) {
  const totalPages = pageCount(total, pageSize);
  if (totalPages <= 1) return null;

  const t = await getTranslations("site");
  const locale = await getLocale();
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav aria-label={t("menu.pagination")} className="flex items-center justify-between gap-3">
      <p className="text-body-small text-muted-foreground" aria-live="polite">
        {t("menu.pageRange", {
          first: formatNumber(first, locale),
          last: formatNumber(last, locale),
          total: formatNumber(total, locale),
        })}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href(page - 1)} rel="prev">
              <Icon icon={ChevronLeft} size="xs" className="rtl:rotate-180" />
              {t("menu.previousPage")}
            </Link>
          </Button>
        ) : null}
        {page < totalPages ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href(page + 1)} rel="next">
              {t("menu.nextPage")}
              <Icon icon={ChevronRight} size="xs" className="rtl:rotate-180" />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
