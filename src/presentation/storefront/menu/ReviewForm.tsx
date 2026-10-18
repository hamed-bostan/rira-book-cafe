"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { MAX_REVIEW_COMMENT_LENGTH, type ProductReview } from "@/src/domain/entities/ProductReview";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { RatingStars } from "@/src/presentation/design-system/components/RatingStars/RatingStars";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

type ReviewFormProps = {
  productId: string;
  /** The review the guest already wrote, to edit. */
  review: ProductReview | null;
};

const STATUS_VARIANT = { pending: "warning", approved: "success", rejected: "neutral" } as const;

/**
 * Write (or rewrite) a review of an item the guest has had: stars and a few
 * optional words. It's shown once staff approve it; a rewrite waits again.
 */
export function ReviewForm({ productId, review }: ReviewFormProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();

  const [rating, setRating] = React.useState(review?.rating ?? 0);
  const [comment, setComment] = React.useState(review?.comment ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    if (rating === 0) {
      setError(t("reviews.pickRating"));
      return;
    }
    startTransition(async () => {
      try {
        await storefrontApi.submitReview(productId, { rating, comment });
        toast({ tone: "success", title: t("reviews.saved") });
        router.refresh();
      } catch (err) {
        const field = err instanceof ApiError ? (err.fieldErrors?.rating ?? err.fieldErrors?.comment) : undefined;
        setError(
          field
            ? (formErrorMessage(tFormErrors, field) ?? field)
            : localizeApiError(err, tApiErrors, t("reviews.saveError")),
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-card-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body-strong text-foreground">{review ? t("reviews.yourReview") : t("reviews.write")}</h3>
        {review ? <Badge variant={STATUS_VARIANT[review.status]}>{t(`reviews.status.${review.status}`)}</Badge> : null}
      </div>
      <RatingStars value={rating} onChange={setRating} size="sm" label={t("reviews.ratingLabel")} />
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={MAX_REVIEW_COMMENT_LENGTH}
        rows={3}
        placeholder={t("reviews.commentPlaceholder")}
        aria-label={t("reviews.commentLabel")}
      />
      <p className="text-body-caption text-muted-foreground">{t("reviews.moderationHint")}</p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <Button type="submit" size="sm" className="self-end" loading={pending}>
        {pending ? t("reviews.saving") : review ? t("reviews.update") : t("reviews.submit")}
      </Button>
    </form>
  );
}
