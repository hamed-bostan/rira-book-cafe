"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

/**
 * The guest deletes their own review of an item, after a confirm. Its stars leave
 * the item's rating; they can write a new one any time.
 */
export function DeleteMyReviewButton({ productId }: { productId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => setOpen(true)}>
        {t("reviews.delete")}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("reviews.deleteTitle")}
        message={t("reviews.deleteMessage")}
        confirmLabel={t("reviews.delete")}
        cancelLabel={t("keep")}
        onConfirm={() => {
          setOpen(false);
          startTransition(async () => {
            try {
              await storefrontApi.deleteMyReview(productId);
              toast({ tone: "success", title: t("reviews.deleted") });
            } catch (err) {
              toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("reviews.deleteError")) });
            }
            router.refresh();
          });
        }}
      />
    </>
  );
}
