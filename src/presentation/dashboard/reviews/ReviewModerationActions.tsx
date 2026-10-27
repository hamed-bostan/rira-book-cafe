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

import { reviewsApi } from "./review-api";

type ReviewModerationActionsProps = {
  review: Pick<ProductReview, "id" | "status" | "productName">;
};

/**
 * A review's controls. One that's waiting gets "Approve" and "Hide" side by side;
 * one already decided keeps the way back behind "⋯" ("Hide from menu" / "Show on
 * menu"). Each writes over the REST API and `router.refresh()`es; a 409 (someone
 * decided first, or the guest rewrote it) shows as a toast.
 */
export function ReviewModerationActions({ review }: ReviewModerationActionsProps) {
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
        toast({ tone: "success", title: t(`moderated.${status}`, { item: review.productName }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  if (review.status === "pending") {
    return (
      <div className="ms-auto flex shrink-0 items-center gap-2">
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
          <Icon icon={Check} size="xs" strokeWidth={2} />
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
      </div>
    );
  }

  const next: ModerationStatus = review.status === "approved" ? "rejected" : "approved";
  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuIconTrigger
          appearance="secondary"
          disabled={pending}
          aria-label={t("moreActionsAria", { item: review.productName })}
        >
          <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => save(next)}>{t(`switchTo.${next}`)}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
