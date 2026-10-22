"use client";

import { useTranslations } from "next-intl";

import type { PromoCode } from "@/src/domain/entities/Promotion";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";

import { PromoCodeForm } from "./PromoCodeForm";

type PromoCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The code to edit; omit to create one. */
  promo?: PromoCode;
  takenCodes: readonly string[];
  /** Today on the cafe calendar. */
  today: string;
};

/**
 * Create or edit a promo code, in a dialog. Controlled, so a row's ⋯ menu can open
 * it. The form mounts fresh each time the dialog opens, so it always starts from
 * the code as saved.
 */
export function PromoCodeDialog({ open, onOpenChange, promo, takenCodes, today }: PromoCodeDialogProps) {
  const t = useTranslations("dashPromotions");

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title={promo ? t("editTitle", { code: promo.code }) : t("newTitle")}
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
        titleClassName="text-start text-body-lead"
      >
        <p className="mt-1 text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {promo ? t("editSub") : t("newSub")}
        </p>
        <PromoCodeForm
          promo={promo}
          takenCodes={takenCodes}
          today={today}
          onDone={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </ModalContent>
    </Modal>
  );
}
