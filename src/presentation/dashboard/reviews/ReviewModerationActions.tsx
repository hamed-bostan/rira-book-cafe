"use client";

import { Check, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { ModerationStatus, ProductReview } from "@/src/domain/entities/ProductReview";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DeleteReviewDialog } from "./DeleteReviewDialog";
import { reviewsApi } from "./review-api";
import { ReviewReplyDialog } from "./ReviewReplyDialog";

type ReviewModerationActionsProps = {
  review: Pick<ProductReview, "id" | "status" | "productName" | "authorName" | "reply">;
};

/**
 * A review's controls. One that's waiting gets "Approve" and "Hide" side by side;
 * one that's shown gets "Reply" until the cafe has answered it. Behind "⋯": the
 * way back ("Hide from menu" / "Show on menu"), editing or taking down the reply,
 * and deleting the review (after a confirm). Each writes over the REST API and
 * `router.refresh()`es; a 409 (someone decided first, or the guest rewrote it)
 * shows as a toast.
 */
export function ReviewModerationActions({ review }: ReviewModerationActionsProps) {
  const t = useTranslations("dashReviews");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  /** The decision in flight — only its button shows the spinner. */
  const [active, setActive] = React.useState<ModerationStatus | "removeReply" | null>(null);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  function save(status: ModerationStatus): void {
    setActive(status);
    startTransition(async () => {
      try {
        await reviewsApi.moderate(review.id, { status });
        toast({ tone: "success", title: t(`moderated.${status}`, { item: review.productName }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  function removeReply(): void {
    setActive("removeReply");
    startTransition(async () => {
      try {
        await reviewsApi.removeReply(review.id);
        toast({ tone: "success", title: t("replyRemovedToast") });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("replyError")) });
      }
      router.refresh();
    });
  }

  const shown = review.status === "approved";
  const next: ModerationStatus = shown ? "rejected" : "approved";

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      {review.status === "pending" ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            // The tick reads as part of the word, so it keeps the ink colour.
            className="gap-2 px-3 [&_svg]:text-foreground"
            loading={pending && active === "approved"}
            disabled={pending}
            onClick={() => save("approved")}
          >
            <Icon icon={Check} size="icon-md" strokeWidth={2} />
            {t("action.approved")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="px-3"
            loading={pending && active === "rejected"}
            disabled={pending}
            onClick={() => save("rejected")}
          >
            {t("action.rejected")}
          </Button>
        </>
      ) : null}
      {shown && !review.reply ? (
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="px-3"
          disabled={pending}
          onClick={() => setReplyOpen(true)}
        >
          {t("reply")}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuIconTrigger
          appearance="secondary"
          disabled={pending}
          aria-label={t("moreActionsAria", { item: review.productName })}
        >
          <Icon icon={MoreHorizontal} size="icon-md" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          {review.status !== "pending" ? (
            <DropdownMenuItem onSelect={() => save(next)}>{t(`switchTo.${next}`)}</DropdownMenuItem>
          ) : null}
          {shown && review.reply ? (
            <>
              <DropdownMenuItem onSelect={() => setReplyOpen(true)}>{t("editReply")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={removeReply}>{t("removeReply")}</DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReviewReplyDialog review={review} open={replyOpen} onOpenChange={setReplyOpen} />
      <DeleteReviewDialog review={review} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
