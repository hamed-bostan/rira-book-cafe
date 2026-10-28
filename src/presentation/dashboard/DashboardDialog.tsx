"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";

import { DIALOG_TITLE } from "./fieldStyles";
import { FormAlert } from "./FormAlert";

import type { ReactNode } from "react";

/** The tint a preview takes when it says something: settled, worth a look, or a problem. */
export type DashboardDialogTone = "neutral" | "success" | "warning" | "danger";

const PREVIEW_TONE: Record<DashboardDialogTone, string> = {
  neutral: "bg-muted text-foreground/80",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-error text-error-foreground",
};

type DashboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title: what saving does, or what's about to change. */
  subtitle: ReactNode;
  submitLabel: string;
  /** Nothing to save yet, or something's wrong — the save button waits, dimmed. */
  blocked?: boolean;
  pending: boolean;
  onSubmit: () => void;
  /** What saving will do, worked out as the fields are filled in. */
  preview?: string;
  previewTone?: DashboardDialogTone;
  error?: string | null;
  /** The action can't be taken back (cancel, delete, void): the button is drawn in the danger colour. */
  danger?: boolean;
  /** A line above the buttons — a way to a fuller form, say. */
  aside?: ReactNode;
  /** The fields. A confirmation has none. */
  children?: ReactNode;
};

/**
 * Every dialog on the redesigned dashboard: a title and what saving does, the
 * fields, a preview of the result, what's wrong, then Back and the action —
 * red when it can't be undone. Confirmations use it too, with no fields, so
 * asking "Cancel this booking?" reads the same as filling in a form.
 */
export function DashboardDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  submitLabel,
  blocked = false,
  pending,
  onSubmit,
  preview,
  previewTone = "neutral",
  error,
  danger = false,
  aside,
  children,
}: DashboardDialogProps) {
  const t = useTranslations("dashboard");

  return (
    <Modal open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <ModalContent
        title={title}
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
        titleClassName={DIALOG_TITLE}
      >
        <div className="mt-1 text-body-default text-pretty text-muted-foreground sm:text-body-small">{subtitle}</div>
        <form
          noValidate
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!blocked && !pending) onSubmit();
          }}
        >
          {children ? <div className="flex flex-col gap-4">{children}</div> : null}

          {preview ? (
            <p
              aria-live="polite"
              className={cn(
                "rounded-button px-4 py-3 text-body-default text-pretty tabular-nums sm:text-body-small",
                PREVIEW_TONE[previewTone],
              )}
            >
              {preview}
            </p>
          ) : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
          {aside}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-3"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("dialogBack")}
            </Button>
            <Button
              type="submit"
              variant={danger ? "destructive" : "primary"}
              size="control-md"
              className="px-4"
              loading={pending}
              disabled={blocked}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
