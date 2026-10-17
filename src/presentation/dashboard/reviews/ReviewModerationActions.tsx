"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { MODERATION_STATUSES, type ModerationStatus, type ProductReview } from "@/src/domain/entities/ProductReview";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage } from "@/src/presentation/design-system";

import { reviewsApi } from "./review-api";

/** Approve or reject one review; a 409 (changed meanwhile) shows inline. */
export function ReviewModerationActions({ review }: { review: Pick<ProductReview, "id" | "status"> }) {
  const t = useTranslations("dashReviews");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function save(status: ModerationStatus): void {
    setError(null);
    startTransition(async () => {
      try {
        await reviewsApi.moderate(review.id, { status });
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("updateError")));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {MODERATION_STATUSES.filter((status) => status !== review.status).map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={status === "approved" ? "primary" : "outline"}
            disabled={pending}
            onClick={() => save(status)}
          >
            {t(`action.${status}`)}
          </Button>
        ))}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
