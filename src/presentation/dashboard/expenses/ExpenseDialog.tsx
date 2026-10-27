"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";

import type { ReactNode } from "react";

type ExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title: what saving does, or which bill this is. */
  subtitle: string;
  submitLabel: string;
  /** Nothing to save yet, or something's wrong — the save button waits. */
  blocked?: boolean;
  pending: boolean;
  onSubmit: () => void;
  /** What saving will book, worked out as you type. */
  preview?: string;
  error?: string | null;
  /** The save can't be taken back (voiding): the button is drawn in the danger colour. */
  danger?: boolean;
  children?: ReactNode;
};

/**
 * The frame every Expenses dialog shares: a title and what saving does, the
 * fields, a preview of what will be booked, any error, and Back / save — so
 * recording, paying and voiding read the same.
 */
export function ExpenseDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  submitLabel,
  blocked = false,
  pending,
  onSubmit,
  preview,
  error,
  danger = false,
  children,
}: ExpenseDialogProps) {
  const t = useTranslations("dashExpenses");

  return (
    <Modal open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <ModalContent
        title={title}
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
        titleClassName="text-start text-body-lead tracking-tight lg:text-heading-subsection"
      >
        <p className="mt-1 text-body-default text-pretty text-muted-foreground sm:text-body-small">{subtitle}</p>
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
              className="rounded-button bg-muted px-4 py-3 text-body-default text-pretty text-foreground/80 tabular-nums sm:text-body-small"
            >
              {preview}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-body-default font-medium text-pretty text-error-foreground sm:text-body-small"
            >
              <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0 sm:size-4" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-3"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("back")}
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
