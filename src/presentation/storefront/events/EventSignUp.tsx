"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_SEATS_PER_REGISTRATION, type EventRegistration } from "@/src/domain/entities/CafeEvent";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

type EventSignUpProps = {
  eventId: string;
  /** Whether sign-ups are open (published, not started, not full). */
  open: boolean;
  /** Seats left, or `undefined` for no limit. */
  seatsLeft?: number;
  signedIn: boolean;
  /** The guest's active sign-up for this event, if any. */
  registration?: Pick<EventRegistration, "id" | "seats">;
};

/**
 * Sign up for an event — or, once signed up, see it and cancel. Capacity is
 * enforced by the server; the seat picker only offers what's left.
 */
export function EventSignUp({ eventId, open, seatsLeft, signedIn, registration }: EventSignUpProps) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [seats, setSeats] = React.useState(1);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  /** Runs a sign-up change; `success` is toasted when the refreshed panel doesn't make the outcome obvious. */
  function run(action: () => Promise<unknown>, success?: string): void {
    startTransition(async () => {
      try {
        await action();
        if (success) toast({ tone: "success", title: success });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("events.error")) });
      }
      router.refresh();
    });
  }

  if (registration) {
    return (
      <div className="flex flex-col gap-3 rounded-card-lg border border-primary bg-accent p-4">
        <p className="text-body-strong text-primary">
          {t("events.signedUp", { count: registration.seats, formatted: formatNumber(registration.seats, locale) })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          loading={pending}
          onClick={() => setConfirmCancel(true)}
        >
          {t("events.cancelSignUp")}
        </Button>
        <ConfirmSheet
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          title={t("events.cancelTitle")}
          message={t("events.cancelMessage")}
          confirmLabel={t("events.cancelSignUp")}
          cancelLabel={t("keep")}
          onConfirm={() => {
            setConfirmCancel(false);
            run(() => storefrontApi.cancelRegistration(registration.id), t("events.signUpCancelled"));
          }}
        />
      </div>
    );
  }

  if (!open) {
    return (
      <p className="rounded-card-md border border-border px-4 py-3 text-body-small text-muted-foreground">
        {t("events.closed")}
      </p>
    );
  }

  if (!signedIn) {
    return (
      <Button asChild>
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/events/${eventId}`)}`}>{t("events.signInToJoin")}</Link>
      </Button>
    );
  }

  const max = Math.min(MAX_SEATS_PER_REGISTRATION, seatsLeft ?? MAX_SEATS_PER_REGISTRATION);

  return (
    <div className="flex flex-col gap-3 rounded-card-lg border border-border p-4">
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("events.seats")}
        <Select value={seats} onChange={(event) => setSeats(Number(event.target.value))} className="max-w-40">
          {Array.from({ length: max }, (_, i) => i + 1).map((count) => (
            <option key={count} value={count}>
              {formatNumber(count, locale)}
            </option>
          ))}
        </Select>
      </label>
      <Button
        type="button"
        className="self-start"
        loading={pending}
        onClick={() => run(() => storefrontApi.registerForEvent(eventId, { seats }))}
      >
        {pending ? t("events.joining") : t("events.join")}
      </Button>
    </div>
  );
}
