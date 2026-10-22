"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { SuiteBooking, SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { suiteBookingsApi } from "./suite-booking-api";

type SuiteStayActionsProps = {
  booking: Pick<SuiteBooking, "id" | "reference" | "status" | "checkIn">;
  today: string;
  /** The held stay a request overlaps — Confirm stays off, and says why. */
  clashReference: number | undefined;
  /** The check-in day, formatted — "Check-in opens on Oct 27". */
  checkInLabel: string;
};

/**
 * The desk's controls for one stay: Confirm a request (off while it clashes with a
 * held stay), Check in from the arrival day on, Check out, and behind "⋯" Mark
 * no-show (once the guest was due) or Cancel booking — both asking first. Each
 * writes over the REST API and `router.refresh()`es; a 409 shows as a toast.
 */
export function SuiteStayActions({ booking, today, clashReference, checkInLabel }: SuiteStayActionsProps) {
  const t = useTranslations("dashSuite");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState<"cancelled" | "noShow" | null>(null);

  const { status, reference } = booking;
  const arrived = booking.checkIn <= today;

  function save(next: SuiteBookingStatus): void {
    startTransition(async () => {
      try {
        await suiteBookingsApi.update(booking.id, { status: next });
        toast({ tone: "success", title: t("statusChanged", { reference, status: t(`status.${next}`) }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  const primary =
    status === "requested"
      ? {
          label: t("action.confirmed"),
          next: "confirmed" as const,
          blockedBy: clashReference === undefined ? null : t("clashShort", { reference: clashReference }),
        }
      : status === "confirmed"
        ? {
            label: t("action.checkedIn"),
            next: "checkedIn" as const,
            blockedBy: arrived ? null : t("checkInOpens", { day: checkInLabel }),
          }
        : status === "checkedIn"
          ? { label: t("action.checkedOut"), next: "checkedOut" as const, blockedBy: null }
          : null;
  if (!primary) return null;

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      {status === "requested" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming("cancelled")}
          className="px-3 font-medium text-muted-foreground hover:bg-muted hover:text-error-foreground"
        >
          {t("action.cancelled")}
        </Button>
      ) : null}
      {/* A disabled button can't show a tooltip, so the reason rides on a wrapper. */}
      <span title={primary.blockedBy ?? undefined}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="px-3"
          loading={pending}
          disabled={primary.blockedBy !== null}
          onClick={() => save(primary.next)}
        >
          {primary.label}
        </Button>
      </span>
      {status === "confirmed" ? (
        <DropdownMenu>
          <DropdownMenuIconTrigger
            appearance="outline"
            disabled={pending}
            aria-label={t("moreActionsAria", { reference })}
          >
            <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
          </DropdownMenuIconTrigger>
          <DropdownMenuContent align="end">
            {arrived ? (
              <DropdownMenuItem destructive onSelect={() => setConfirming("noShow")}>
                {t("markNoShow")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem destructive onSelect={() => setConfirming("cancelled")}>
              {t("cancelBooking")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ConfirmSheet
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? t(`confirmTitle.${confirming}`, { reference }) : ""}
        message={t("confirmMessage")}
        confirmLabel={confirming === "noShow" ? t("markNoShow") : t("cancelBooking")}
        cancelLabel={t("dialogCancel")}
        onConfirm={() => {
          if (confirming) save(confirming);
          setConfirming(null);
        }}
      />
    </div>
  );
}
