import { Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Page } from "@/src/domain/entities/Pagination";
import {
  REVIEW_RATINGS,
  type ProductReview,
  type RatingSummary,
  type ReviewedProduct,
  type ReviewStatus,
} from "@/src/domain/entities/ProductReview";
import { REVIEW_VIEWS, type ReviewView } from "@/src/domain/repositories/IReviewRepository";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { ListChoiceFilter, ListPager, ListSearchInput } from "@/src/presentation/dashboard/list";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { ReviewRow } from "./ReviewRow";

/** "4.6", never "5" — the average always shows its tenth. */
const RATING_DECIMALS = 1;

type ReviewsScreenProps = {
  /** One page of the reviews in the current view that match the search and filters. */
  reviews: Page<ProductReview>;
  /** How many reviews sit in each status, search aside — the numbers on the tabs. */
  counts: Record<ReviewStatus, number>;
  /** The average across every approved review, for the line under the heading. */
  rating: RatingSummary;
  view: ReviewView;
  /** The search, when one is applied — to tell "nothing here" from "no matches". */
  query: string | undefined;
  /** The item filter, when one is applied. */
  productId: string | undefined;
  /** The stars filter, when one is applied. */
  stars: number | undefined;
  /** The items that have reviews — the item filter's choices. */
  products: ReviewedProduct[];
};

/**
 * The review queue: what guests wrote about what they had, in Waiting / Shown /
 * Hidden / All tabs with a search, filters by item and by stars, and a pager; the
 * average of what's shown sits under the heading. Nothing reaches the menu until
 * it's approved; a shown review can get the cafe's reply. Presentational — the
 * page fetches one page over the REST API (BFF); the view, search, filters and
 * page live in the URL, and every decision `router.refresh()`es.
 */
export async function ReviewsScreen({
  reviews,
  counts,
  rating,
  view,
  query,
  productId,
  stars,
  products,
}: ReviewsScreenProps) {
  const t = await getTranslations("dashReviews");
  const locale = await getLocale();

  const countFor = (tab: ReviewView): number =>
    tab === "all" ? counts.pending + counts.approved + counts.rejected : counts[tab];

  // A tab keeps the search and filters, and starts over at page 1.
  const hrefFor = (tab: ReviewView): string => {
    const params = new URLSearchParams();
    if (tab !== "pending") params.set("view", tab);
    if (query) params.set("q", query);
    if (productId) params.set("productId", productId);
    if (stars) params.set("rating", String(stars));
    const qs = params.toString();
    return qs ? `/dashboard/reviews?${qs}` : "/dashboard/reviews";
  };

  // A view with nothing in it says why: a search or filter that missed, an empty queue, or a tab with nothing yet.
  const empty =
    query || productId || stars
      ? { title: t("noMatchesTitle"), body: t("noMatchesBody") }
      : view === "pending"
        ? { title: t("caughtUpTitle"), body: t("caughtUpBody") }
        : { title: t("emptyTitle"), body: t("emptyBody") };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="flex flex-wrap items-center gap-x-2 text-body-default text-muted-foreground sm:text-body-small">
          <span>{t("subtitle")}</span>
          {rating.ratingCount > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={Star} size="xs" className="fill-current text-warning-foreground" />
                {t("average", {
                  rating: formatNumber(rating.rating, locale, RATING_DECIMALS),
                  count: rating.ratingCount,
                  formatted: formatNumber(rating.ratingCount, locale),
                })}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <section
        aria-label={t("listLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <DashboardLinkTabs
          className="px-4"
          label={t("viewLabel")}
          current={view}
          tabs={REVIEW_VIEWS.map((tab) => ({
            key: tab,
            label: t(`view.${tab}`),
            count: countFor(tab),
            href: hrefFor(tab),
          }))}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <ListSearchInput
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="max-w-md min-w-0 flex-[1_1_15rem]"
          />
          {products.length > 0 ? (
            <ListChoiceFilter
              paramName="productId"
              label={t("filterItem")}
              allLabel={t("allItems")}
              showAllValue
              options={products.map((product) => ({ value: product.productId, label: product.productName }))}
            />
          ) : null}
          <ListChoiceFilter
            paramName="rating"
            label={t("filterStars")}
            allLabel={t("allStars")}
            showAllValue
            options={REVIEW_RATINGS.map((value) => ({
              value: String(value),
              label: t("starsOption", { count: value, formatted: formatNumber(value, locale) }),
            }))}
          />
        </div>

        {reviews.items.length > 0 ? (
          <>
            <ul>
              {reviews.items.map((review, index) => (
                <li key={review.id} className={cn(index > 0 && "border-t border-border")}>
                  <ReviewRow review={review} />
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3">
              <ListPager page={reviews} />
            </div>
          </>
        ) : (
          <DashboardEmptyState title={empty.title} body={empty.body} />
        )}
      </section>
    </div>
  );
}
