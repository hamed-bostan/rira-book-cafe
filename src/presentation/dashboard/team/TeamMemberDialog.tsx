"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";

import type { ReactNode } from "react";

type TeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What saving does, under the title. */
  message: string;
  submitLabel: string;
  /** Takes access away — the submit button is drawn in the danger colour. */
  destructive?: boolean;
  /** Nothing to save yet — the submit button waits. */
  blocked?: boolean;
  pending: boolean;
  onSubmit: () => void;
  error?: string | null;
  children?: ReactNode;
};

/**
 * The frame every change to a member asks through: a title, what it will do, any
 * field it needs, an error if it was refused, and Back / the change — so changing
 * a role, handing over ownership and removing access read the same. It can't be
 * dismissed while the change is on its way.
 */
export function TeamMemberDialog({
  open,
  onOpenChange,
  title,
  message,
  submitLabel,
  destructive = false,
  blocked = false,
  pending,
  onSubmit,
  error,
  children,
}: TeamMemberDialogProps) {
  const t = useTranslations("dashTeam");

  return (
    <Modal open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <ModalContent
        title={title}
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col overflow-y-auto"
        titleClassName="text-start text-body-lead"
      >
        <p className="mt-1 text-body-default text-pretty text-muted-foreground sm:text-body-small">{message}</p>
        <form
          noValidate
          className="mt-5 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!blocked && !pending) onSubmit();
          }}
        >
          {children}
          {error ? <FormMessage className="font-medium">{error}</FormMessage> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-4"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("back")}
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "primary"}
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
