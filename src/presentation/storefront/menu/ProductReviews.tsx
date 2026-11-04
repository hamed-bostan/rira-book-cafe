import { Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import {
  MAX_PUBLIC_REVIEW_LIMIT,
  PUBLIC_REVIEW_LIMIT,
  type PublicReviewPage,
  type ReviewEligibility,
} from "@/src/domain/entities/ProductReview";
import { Link } from "@/src/i18n/navigation";
import { formatNumber, formatRating } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { RatingStars } from "@/src/presentation/design-system/components/RatingStars/RatingStars";

import { ReviewForm } from "./ReviewForm";

type ProductReviewsProps = {
  productId: string;
  rating: number;
  ratingCount: number;
  /** The approved reviews shown so far, newest first, and how many there are. */
  reviews: PublicReviewPage;
  /** `null` when the guest is signed out. */
  eligibility: ReviewEligibility | null;
};

/**
 * What guests who had the item thought: the average, the approved reviews (each
 * with the cafe's reply under it, when there is one), and — for a signed-in guest
 * who has had it — the form to add theirs.
 *
 * The first page of reviews comes with the page; "Show more" is a link that asks
 * the server for the next page too (`?reviews=`), so it works without JavaScript
 * and leaves the scroll where it was.
 */
export async function ProductReviews({ productId, rating, ratingCount, reviews, eligibility }: ProductReviewsProps) {
  const [t, tMeta, locale] = await Promise.all([getTranslations("site"), getTranslations("meta"), getLocale()]);
  const cafeName = tMeta("siteName");
  const shown = reviews.items.length;
  const more = shown < reviews.total && shown < MAX_PUBLIC_REVIEW_LIMIT;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-heading" className="text-heading-subsection text-foreground">
          {t("reviews.heading")}
        </h2>
        {ratingCount > 0 ? (
          <span className="flex items-center gap-2 text-body-small text-muted-foreground">
            <RatingStars value={Math.round(rating)} size="sm" />
            {t("reviews.summary", {
              rating: formatRating(rating, locale),
              count: ratingCount,
              formatted: formatNumber(ratingCount, locale),
            })}
          </span>
        ) : null}
      </div>

      {eligibility === null ? (
        <p className="text-body-small text-muted-foreground">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/menu/${productId}`)}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {t("reviews.signInToReview")}
          </Link>
        </p>
      ) : eligibility.canReview ? (
        <ReviewForm productId={productId} review={eligibility.review} />
      ) : (
        <p className="text-body-small text-muted-foreground">{t("reviews.notYetHad")}</p>
      )}

      {reviews.items.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t("reviews.empty")}
          className="rounded-card-lg border border-dashed border-border py-10"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.items.map((review) => (
            <li key={review.id} className="flex flex-col gap-1 rounded-card-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={review.rating} size="sm" />
                <span className="text-body-small-strong text-foreground">
                  {review.authorName || t("reviews.anonymous")}
                </span>
                <span className="text-body-caption text-muted-foreground">
                  {formatOrderDateShort(review.createdAt, locale)}
                </span>
              </div>
              {review.comment ? (
                <p className="text-body-small whitespace-pre-wrap text-foreground">{review.comment}</p>
              ) : null}
              <span className="text-body-caption text-muted-foreground">{t("reviews.verified")}</span>
              {review.reply ? (
                <div className="mt-2 flex flex-col gap-1 rounded-card-md border-s-2 border-primary bg-muted px-3 py-2">
                  <span className="text-body-small-strong text-foreground">
                    {t("reviews.replyFrom", { cafe: cafeName })}
                    <span className="ms-2 text-body-caption font-normal text-muted-foreground">
                      {formatOrderDateShort(review.reply.at, locale)}
                    </span>
                  </span>
                  <p dir="auto" className="text-body-small whitespace-pre-wrap text-foreground">
                    {review.reply.text}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {shown > 0 && reviews.total > shown ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-body-small text-muted-foreground">
            {t("reviews.showing", {
              shown: formatNumber(shown, locale),
              total: formatNumber(reviews.total, locale),
            })}
          </span>
          {more ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/menu/${productId}?reviews=${shown + PUBLIC_REVIEW_LIMIT}`} scroll={false}>
                {t("reviews.showMore")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
