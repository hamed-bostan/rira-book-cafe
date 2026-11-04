import { getLocale, getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { MAX_REVIEW_RATING, type ProductReview, type ReviewStatus } from "@/src/domain/entities/ProductReview";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { ReviewModerationActions } from "./ReviewModerationActions";
import { ReviewStars } from "./ReviewStars";

type ReviewRowProps = {
  review: ProductReview;
};

/** Waiting asks for a look, shown is settled, hidden steps back. */
const STATUS_VARIANT: Record<ReviewStatus, NonNullable<BadgeProps["variant"]>> = {
  pending: "warning",
  approved: "success",
  rejected: "neutral",
};

/**
 * One review: the item and where the review stands, the guest's stars and name,
 * when they wrote it (and who decided, once someone has), their words, and the
 * desk's controls.
 */
export async function ReviewRow({ review }: ReviewRowProps) {
  const t = await getTranslations("dashReviews");
  const locale = await getLocale();

  const author = review.authorName || t("anonymous");
  const day = (iso: string): string => formatCafeDayShort(cafeDayOf(new Date(iso)), locale);
  const stars = t("starsLabel", {
    rating: formatNumber(review.rating, locale),
    max: formatNumber(MAX_REVIEW_RATING, locale),
  });

  return (
    <article
      aria-label={t("rowLabel", { item: review.productName, stars, author })}
      className="flex flex-wrap items-start gap-x-5 gap-y-3 px-5 py-4"
    >
      <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/menu/${review.productId}`}
            dir="auto"
            className={cn("text-body-strong text-foreground transition-colors hover:text-primary", focusRing)}
          >
            {review.productName}
          </Link>
          <Badge variant={STATUS_VARIANT[review.status]} appearance="outline" size="compact" dot>
            {t(`status.${review.status}`)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ReviewStars rating={review.rating} label={stars} />
          <span className="text-body-default font-medium text-foreground sm:text-body-small">{author}</span>
          <span className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
            {day(review.createdAt)}
            {review.moderatedByName && review.moderatedAt
              ? ` · ${t("moderatedBy", { name: review.moderatedByName, date: day(review.moderatedAt) })}`
              : null}
          </span>
        </div>
        {/* A guest writes in whichever language they like; it reads in its own direction. */}
        {review.comment ? (
          <p
            dir="auto"
            className="text-body-default text-pretty whitespace-pre-wrap text-foreground/80 sm:text-body-small"
          >
            {review.comment}
          </p>
        ) : null}
        {/* The cafe's reply, as it reads under the review on the item's page — with
            who on the team wrote it, which guests don't see. */}
        {review.reply ? (
          <div className="mt-1 flex flex-col gap-1 rounded-button border-s-2 border-primary bg-muted px-3 py-2">
            <span className="text-body-small font-semibold text-foreground sm:text-body-caption">
              {t("replyBy", { name: review.reply.byName, date: day(review.reply.updatedAt ?? review.reply.at) })}
            </span>
            <p
              dir="auto"
              className="text-body-default text-pretty whitespace-pre-wrap text-foreground/80 sm:text-body-small"
            >
              {review.reply.text}
            </p>
          </div>
        ) : null}
      </div>

      <ReviewModerationActions review={review} />
    </article>
  );
}
