"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { ProductReview } from "@/src/domain/entities/ProductReview";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { reviewsApi } from "./review-api";

type DeleteReviewDialogProps = {
  review: Pick<ProductReview, "id" | "productName" | "authorName" | "status">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirms deleting a review for good: Back, or a red Delete. A shown review's
 * stars leave the item's rating with it; the activity log keeps what it said.
 * Hiding it is the reversible alternative, and the dialog says so.
 */
export function DeleteReviewDialog({ review, open, onOpenChange }: DeleteReviewDialogProps) {
  const t = useTranslations("dashReviews");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function remove(): void {
    setError(null);
    startTransition(async () => {
      try {
        await reviewsApi.remove(review.id);
        toast({ tone: "success", title: t("deletedToast", { item: review.productName }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("deleteError")));
        router.refresh();
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title={t("deleteTitle", { item: review.productName, author: review.authorName || t("anonymous") })}
      subtitle={review.status === "approved" ? t("deleteMessageShown") : t("deleteMessage")}
      submitLabel={t("deleteConfirm")}
      pending={pending}
      onSubmit={remove}
      error={error}
      danger
    />
  );
}
