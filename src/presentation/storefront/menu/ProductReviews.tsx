import { getLocale, getTranslations } from "next-intl/server";

import type { PublicReview, ReviewEligibility } from "@/src/domain/entities/ProductReview";
import { Link } from "@/src/i18n/navigation";
import { formatNumber, formatRating } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { RatingStars } from "@/src/presentation/design-system";

import { ReviewForm } from "./ReviewForm";

type ProductReviewsProps = {
  productId: string;
  rating: number;
  ratingCount: number;
  reviews: PublicReview[];
  /** `null` when the guest is signed out. */
  eligibility: ReviewEligibility | null;
};

/**
 * What guests who had the item thought: the average, the approved reviews, and —
 * for a signed-in guest who has had it — the form to add theirs.
 */
export async function ProductReviews({ productId, rating, ratingCount, reviews, eligibility }: ProductReviewsProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-heading" className="text-heading-subsection text-foreground">
          {t("reviews.heading")}
        </h2>
        {ratingCount > 0 ? (
          <span className="flex items-center gap-2 text-body-small text-muted-foreground">
            <RatingStars value={Math.round(rating)} size="sm" />
            {t("reviews.summary", { rating: formatRating(rating, locale), count: ratingCount, formatted: formatNumber(ratingCount, locale) })}
          </span>
        ) : null}
      </div>

      {eligibility === null ? (
        <p className="text-body-small text-muted-foreground">
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/menu/${productId}`)}`} className="text-primary underline-offset-4 hover:underline">
            {t("reviews.signInToReview")}
          </Link>
        </p>
      ) : eligibility.canReview ? (
        <ReviewForm productId={productId} review={eligibility.review} />
      ) : (
        <p className="text-body-small text-muted-foreground">{t("reviews.notYetHad")}</p>
      )}

      {reviews.length === 0 ? (
        <p className="text-body-small text-muted-foreground">{t("reviews.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-1 rounded-card-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={review.rating} size="sm" />
                <span className="text-body-small-strong text-foreground">{review.authorName || t("reviews.anonymous")}</span>
                <span className="text-body-caption text-muted-foreground">{formatOrderDateShort(review.createdAt, locale)}</span>
              </div>
              {review.comment ? <p className="whitespace-pre-wrap text-body-small text-foreground">{review.comment}</p> : null}
              <span className="text-body-caption text-muted-foreground">{t("reviews.verified")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
