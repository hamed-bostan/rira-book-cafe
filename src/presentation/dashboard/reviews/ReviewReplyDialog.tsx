"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { MAX_REVIEW_REPLY_LENGTH, type ProductReview } from "@/src/domain/entities/ProductReview";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { reviewsApi } from "./review-api";

type ReviewReplyDialogProps = {
  review: Pick<ProductReview, "id" | "productName" | "authorName" | "reply">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Write (or edit) the cafe's one public reply under a review. It shows under the
 * review on the item's page, signed by the cafe, and the guest is told in their
 * messages the first time it goes up.
 */
export function ReviewReplyDialog({ review, open, onOpenChange }: ReviewReplyDialogProps) {
  const t = useTranslations("dashReviews");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = React.useState(review.reply?.text ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const editing = Boolean(review.reply);

  // Each opening starts from what's saved, not from an abandoned draft. Adjusted
  // during render when `open` flips (React's "state from a prop change" pattern),
  // so the stale draft is never painted.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText(review.reply?.text ?? "");
      setError(null);
    }
  }

  function save(): void {
    setError(null);
    startTransition(async () => {
      try {
        await reviewsApi.reply(review.id, { text });
        toast({ tone: "success", title: editing ? t("replyEditedToast") : t("repliedToast") });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const field = err instanceof ApiError ? err.fieldErrors?.text : undefined;
        setError(
          field ? (formErrorMessage(tFormErrors, field) ?? field) : localizeApiError(err, tApiErrors, t("replyError")),
        );
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("editReplyTitle") : t("replyTitle")}
      subtitle={t("replySubtitle", { item: review.productName, author: review.authorName || t("anonymous") })}
      submitLabel={editing ? t("saveReply") : t("postReply")}
      blocked={text.trim().length === 0}
      pending={pending}
      onSubmit={save}
      error={error}
    >
      <DashboardFormField label={t("replyLabel")} hint={t("replyHint")}>
        {(wiring) => (
          <Textarea
            {...wiring}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_REVIEW_REPLY_LENGTH}
            rows={5}
            dir="auto"
          />
        )}
      </DashboardFormField>
    </DashboardDialog>
  );
}
