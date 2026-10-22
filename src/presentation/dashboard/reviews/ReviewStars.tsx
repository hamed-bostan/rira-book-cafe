import { Star } from "lucide-react";

import { MAX_REVIEW_RATING } from "@/src/domain/entities/ProductReview";
import { cn } from "@/src/lib/utils";

type ReviewStarsProps = {
  /** Whole stars, 1–5. */
  rating: number;
  /** Read out in place of the stars ("4 out of 5 stars"). */
  label: string;
};

/**
 * A review's stars as the queue reads them: the given ones filled in amber, the
 * rest a pale outline — so a one-star review looks empty at a glance. Read-only,
 * and drawn on the server (the storefront's `RatingStars` is the picker).
 */
export function ReviewStars({ rating, label }: ReviewStarsProps) {
  return (
    <span role="img" aria-label={label} className="flex gap-0.5">
      {Array.from({ length: MAX_REVIEW_RATING }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            "size-5 shrink-0 sm:size-4",
            index < rating ? "fill-current text-warning-foreground" : "fill-transparent text-border-strong",
          )}
        />
      ))}
    </span>
  );
}
