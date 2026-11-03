"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_GUEST_MESSAGE_LENGTH, type GuestMessageTopic } from "@/src/domain/entities/GuestMessage";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_TEXTAREA } from "../fieldStyles";

import { guestMessagesApi } from "./guest-message-api";

/** Who a message goes to: the name and phone staff see beside them. */
export type MessageGuestTarget = { name: string; phone: string };

/** What a message is about: the record, and how the dialog names it ("R-12", "#42", a book's title). */
export type MessageGuestAbout = { kind: GuestMessageTopic; id: string; label: string };

type MessageGuestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: MessageGuestTarget;
  about: MessageGuestAbout;
};

/**
 * "Message guest": a few lines of plain text to the guest's messages on the site,
 * about one booking, loan, hold or order. Controlled, so a row can open it from a
 * button or a menu item; {@link MessageGuestButton} is the usual way in. Sending
 * toasts, closes and `router.refresh()`es (the activity panel shows the entry); a
 * failure stays in the dialog.
 */
export function MessageGuestDialog({ open, onOpenChange, guest, about }: MessageGuestDialogProps) {
  const t = useTranslations("dashGuestMessages");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function changeOpen(next: boolean): void {
    if (next) setError(null);
    onOpenChange(next);
  }

  function send(): void {
    setError(null);
    startTransition(async () => {
      try {
        await guestMessagesApi.create({ phone: guest.phone, text, about: { kind: about.kind, id: about.id } });
        toast({
          tone: "success",
          title: t("sentToast", { name: guest.name }),
          description: t("sentToastBody", { phone: guest.phone }),
        });
        setText("");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("sendError")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={changeOpen}
      title={t("title", { name: guest.name })}
      subtitle={t("subtitle", { about: about.label, phone: guest.phone })}
      submitLabel={t("send")}
      blocked={text.trim() === ""}
      pending={pending}
      onSubmit={send}
      error={error}
    >
      <DashboardField
        label={t("label")}
        hint={t("count", {
          used: formatNumber(text.length, locale),
          max: formatNumber(MAX_GUEST_MESSAGE_LENGTH, locale),
        })}
      >
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("placeholder")}
          maxLength={MAX_GUEST_MESSAGE_LENGTH}
          rows={4}
          disabled={pending}
          className={FIELD_TEXTAREA}
        />
      </DashboardField>
    </DashboardDialog>
  );
}
