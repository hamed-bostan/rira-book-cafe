"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";

import { Button } from "../Button";

import { Sheet, SheetClose, SheetContent } from "./Sheet";

type ConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question — becomes the dialog title (start-aligned). */
  title: string;
  /** Friendly line under the title; also serves as the dialog's a11y description. */
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

/**
 * Confirmation bottom sheet: a start-aligned question + message and a
 * Cancel / Confirm action pair, built on <Sheet>. Controlled via `open`.
 * `Cancel` closes; `Confirm` runs `onConfirm` then closes.
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: ConfirmSheetProps) {
  const t = useTranslations("ds");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={title} titleClassName="mb-4 text-start">
        {/* Rendering Dialog.Description here makes the visible message double as the
            dialog's a11y description (so it's referenced, not duplicated sr-only). */}
        {message && (
          <Dialog.Description className="text-body-strong text-muted-foreground text-center">{message}</Dialog.Description>
        )}

        <div className="mt-8 flex gap-3">
          <SheetClose asChild>
            <Button variant="outline" size="lg" className="flex-1">
              {cancelLabel ?? t("confirmCancel")}
            </Button>
          </SheetClose>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel ?? t("confirmYes")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
