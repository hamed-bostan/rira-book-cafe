"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  nextSuiteBookingStatuses,
  type SuiteBooking,
  type SuiteBookingStatus,
} from "@/src/domain/entities/SuiteBooking";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { suiteBookingsApi } from "./suite-booking-api";

type SuiteBookingActionsProps = {
  booking: Pick<SuiteBooking, "id" | "reference" | "status">;
};

/** Steps that withdraw the stay, behind a confirmation. */
const DESTRUCTIVE: readonly SuiteBookingStatus[] = ["cancelled", "noShow"];

/**
 * The front desk's controls for one stay: the workflow steps the current status
 * allows, with a confirmation before cancelling or marking a no-show. Each writes
 * over the REST API and `router.refresh()`es; a 409 (nights already held, someone
 * else moved it) shows as a toast.
 */
export function SuiteBookingActions({ booking }: SuiteBookingActionsProps) {
  const t = useTranslations("dashSuite");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  /** The step in flight — only its button shows the spinner; the rest just disable. */
  const [active, setActive] = React.useState<SuiteBookingStatus | null>(null);
  const [confirming, setConfirming] = React.useState<SuiteBookingStatus | null>(null);

  const steps = nextSuiteBookingStatuses(booking.status);
  if (steps.length === 0) return null;

  function save(status: SuiteBookingStatus): void {
    setActive(status);
    startTransition(async () => {
      try {
        await suiteBookingsApi.update(booking.id, { status });
        toast({
          tone: "success",
          title: t("statusChanged", { reference: booking.reference, status: t(`status.${status}`) }),
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={DESTRUCTIVE.includes(status) ? "outline" : "primary"}
            loading={pending && active === status}
            disabled={pending}
            onClick={() => (DESTRUCTIVE.includes(status) ? setConfirming(status) : save(status))}
          >
            {t(`action.${status}`)}
          </Button>
        ))}
      </div>

      <ConfirmSheet
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming
            ? t(`confirmTitle.${confirming === "noShow" ? "noShow" : "cancelled"}`, { reference: booking.reference })
            : ""
        }
        message={t("confirmMessage")}
        confirmLabel={confirming ? t(`action.${confirming}`) : ""}
        cancelLabel={t("dialogCancel")}
        onConfirm={() => {
          if (confirming) save(confirming);
          setConfirming(null);
        }}
      />
    </div>
  );
}
