"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";

import type { ReactNode } from "react";

type StockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title saying what saving does. */
  subtitle: string;
  submitLabel: string;
  /** Nothing to save yet, or something's wrong — the save button waits. */
  blocked: boolean;
  pending: boolean;
  onSubmit: () => void;
  /** What saving will do to the stock, worked out as you type. */
  preview?: string;
  error?: string | null;
  /** A way to the full form, for what this quick one doesn't cover. */
  fullForm?: { prompt: string; label: string; href: string };
  children: ReactNode;
};

/**
 * The frame every Inventory dialog shares: a title and what saving does, the
 * fields, a preview of the result before anything is saved, any error, and Back /
 * save — so receiving, counting, re-levelling and writing off read the same.
 */
export function StockDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  submitLabel,
  blocked,
  pending,
  onSubmit,
  preview,
  error,
  fullForm,
  children,
}: StockDialogProps) {
  const t = useTranslations("dashInventory");

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title={title}
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
        titleClassName="text-start text-body-lead"
      >
        <p className="mt-1 text-body-default text-pretty text-muted-foreground sm:text-body-small">{subtitle}</p>
        <form
          noValidate
          className="mt-5 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!blocked && !pending) onSubmit();
          }}
        >
          {children}

          {preview ? (
            <p
              aria-live="polite"
              className="rounded-button bg-muted px-4 py-3 text-body-default text-pretty text-foreground/80 sm:text-body-small"
            >
              {preview}
            </p>
          ) : null}
          {error ? <FormMessage>{error}</FormMessage> : null}

          {fullForm ? (
            <p className="text-body-small text-muted-foreground sm:text-body-caption">
              {fullForm.prompt}{" "}
              <Link
                href={fullForm.href}
                className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
              >
                {fullForm.label}
              </Link>
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-4"
              onClick={() => onOpenChange(false)}
            >
              {t("quick.back")}
            </Button>
            <Button type="submit" size="control-md" className="px-4" loading={pending} disabled={blocked}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
