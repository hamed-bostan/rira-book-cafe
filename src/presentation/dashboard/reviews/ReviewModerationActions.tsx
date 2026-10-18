"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { MODERATION_STATUSES, type ModerationStatus, type ProductReview } from "@/src/domain/entities/ProductReview";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { reviewsApi } from "./review-api";

/** Approve or reject one review; a 409 (changed meanwhile) shows as a toast. */
export function ReviewModerationActions({ review }: { review: Pick<ProductReview, "id" | "status"> }) {
  const t = useTranslations("dashReviews");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  /** The decision in flight — only its button shows the spinner. */
  const [active, setActive] = React.useState<ModerationStatus | null>(null);

  function save(status: ModerationStatus): void {
    setActive(status);
    startTransition(async () => {
      try {
        await reviewsApi.moderate(review.id, { status });
        toast({ tone: "success", title: t(`moderated.${status}`) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {MODERATION_STATUSES.filter((status) => status !== review.status).map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          variant={status === "approved" ? "primary" : "outline"}
          loading={pending && active === status}
          disabled={pending}
          onClick={() => save(status)}
        >
          {t(`action.${status}`)}
        </Button>
      ))}
    </div>
  );
}
