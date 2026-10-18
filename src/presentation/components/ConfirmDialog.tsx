"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Modal, ModalClose, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";

interface ConfirmDialogProps {
  /** Controlled open state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading, e.g. "Cancel this order?". */
  title: string;
  /** Body copy explaining the consequence (also used as the a11y description). */
  description: string;
  /** Confirm button label, e.g. "Cancel order". */
  confirmLabel: string;
  /** Dismiss button label. */
  cancelLabel?: string;
  /** Visual weight of the confirm button — matches the DS Button variants. */
  confirmVariant?: "primary" | "outline";
  /** While true both buttons disable and the confirm shows a spinner and a working label. */
  pending?: boolean;
  /** Label shown on the confirm button while `pending`. */
  pendingLabel?: string;
  /** Invoked when the user confirms; the parent owns the actual mutation. */
  onConfirm: () => void;
}

/**
 * A yes/no confirmation modal on top of the design-system `Modal`, for guarding
 * irreversible-feeling actions (cancelling an order, requesting a return,
 * approving a refund). The parent stays in control of the action and its pending
 * state — this component only asks the question.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "primary",
  pending = false,
  pendingLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("ds");

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={title} description={description}>
        <div className="flex flex-col gap-5 pt-2">
          <p className="text-center text-body-small text-muted-foreground">{description}</p>
          <div className="grid grid-cols-2 gap-2">
            <ModalClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={pending}>
                {cancelLabel ?? t("confirmKeep")}
              </Button>
            </ModalClose>
            <Button type="button" variant={confirmVariant} size="sm" loading={pending} onClick={onConfirm}>
              {pending ? (pendingLabel ?? t("confirmWorking")) : confirmLabel}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
