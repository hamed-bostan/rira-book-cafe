import { SearchX, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { ProductReview, ReviewStatus } from "@/src/domain/entities/ProductReview";
import { REVIEW_VIEWS } from "@/src/domain/repositories/IReviewRepository";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { ListFilterSelect, ListSearchInput } from "@/src/presentation/dashboard/list";
import { Badge, EmptyState, RatingStars } from "@/src/presentation/design-system";

import { ReviewModerationActions } from "./ReviewModerationActions";

type ReviewsScreenProps = {
  reviews: ProductReview[];
  counts: Record<ReviewStatus, number>;
  isSearching: boolean;
};

const STATUS_VARIANT = { pending: "warning", approved: "success", rejected: "neutral" } as const;

/**
 * The review queue: what guests wrote about what they had, waiting for a yes or a
 * no. Presentational — the page fetches over the REST API; the view and search
 * live in the URL, and every decision `router.refresh()`es.
 */
export async function ReviewsScreen({ reviews, counts, isSearching }: ReviewsScreenProps) {
  const t = await getTranslations("dashReviews");
  const locale = await getLocale();

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-small text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ListSearchInput label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="min-w-56 flex-1" />
          <div className="min-w-48">
            <ListFilterSelect
              className="h-9 w-full"
              paramName="view"
              label={t("viewLabel")}
              options={REVIEW_VIEWS.map((option) => ({
                // `pending` is the default, so it's the param-less option.
                value: option === "pending" ? "" : option,
                label:
                  option === "all"
                    ? t("viewOption", { view: t(`view.${option}`) })
                    : t("viewOptionCount", { view: t(`view.${option}`), count: formatNumber(counts[option], locale) }),
              }))}
            />
          </div>
        </div>
      </div>

      {reviews.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/menu/${review.productId}`} className="text-body-small-strong text-foreground hover:underline">
                    {review.productName}
                  </Link>
                  <Badge variant={STATUS_VARIANT[review.status]}>{t(`status.${review.status}`)}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars value={review.rating} size="sm" />
                  <span className="text-body-small text-foreground">{review.authorName || t("anonymous")}</span>
                </div>
                {review.comment ? <p className="whitespace-pre-wrap text-body-small text-foreground">{review.comment}</p> : null}
                <p className="text-body-caption text-muted-foreground">
                  {formatOrderDateShort(review.createdAt, locale)}
                  {review.moderatedByName && review.moderatedAt
                    ? ` · ${t("moderatedBy", { name: review.moderatedByName, date: formatOrderDateShort(review.moderatedAt, locale) })}`
                    : null}
                </p>
              </div>
              <div className="shrink-0">
                <ReviewModerationActions review={review} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-card-lg border border-dashed border-border">
          <EmptyState
            icon={isSearching ? SearchX : Star}
            title={isSearching ? t("noMatchesTitle") : t("emptyTitle")}
            description={isSearching ? t("noMatchesBody") : t("emptyBody")}
          />
        </div>
      )}
    </div>
  );
}
