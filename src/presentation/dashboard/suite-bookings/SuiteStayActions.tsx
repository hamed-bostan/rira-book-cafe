"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  canUndoSuiteBookingStatus,
  editableSuiteStayDetails,
  isSuiteStayDue,
  type SuiteBooking,
  type SuiteBookingStatus,
} from "@/src/domain/entities/SuiteBooking";
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
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { useGuestToldLine } from "../guest-messages/useGuestToldLine";

import { EditStayDialog } from "./EditStayDialog";
import { suiteBookingsApi } from "./suite-booking-api";

type SuiteStayActionsProps = {
  booking: Pick<
    SuiteBooking,
    "id" | "reference" | "status" | "checkIn" | "checkOut" | "guests" | "guestName" | "guestPhone" | "userId"
  >;
  /** Stays holding the suite — "Edit stay" warns before moving onto their nights. */
  held: readonly Pick<SuiteBooking, "id" | "reference" | "checkIn" | "checkOut">[];
  today: string;
  /** The held stay a request overlaps — Confirm stays off, and says why. */
  clashReference: number | undefined;
  /** The check-in day, formatted — "Check-in opens on Oct 27". */
  checkInLabel: string;
  /** The stay's nights, formatted — "Oct 22 → Oct 24" — for the confirmation. */
  rangeLabel: string;
};

/** The moves that end a stay early, each asked about first. */
type Ending = "cancelled" | "noShow";

/**
 * The desk's controls for one stay: Confirm a request (off while it clashes with a
 * held stay), Check in from the arrival day on, Check out, and behind "⋯" Edit
 * stay, Mark no-show (once the guest was due) or Cancel booking — the last two
 * asking first, naming the guest and nights. Check in offers Undo in its toast.
 * Each writes over the REST API and `router.refresh()`es; a failure shows in the
 * confirmation when one is open, else as a toast.
 */
export function SuiteStayActions({
  booking,
  held,
  today,
  clashReference,
  checkInLabel,
  rangeLabel,
}: SuiteStayActionsProps) {
  const t = useTranslations("dashSuite");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const guestToldLine = useGuestToldLine();
  const [pending, startTransition] = React.useTransition();
  // Which ending was asked about stays set while the dialog closes, so its words don't change mid-fade.
  const [ending, setEnding] = React.useState<Ending>("cancelled");
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // "Edit stay" mounts afresh each time it opens, so it starts from the stay as it is.
  const [editing, setEditing] = React.useState(false);
  const [editKey, setEditKey] = React.useState(0);

  const { status, reference } = booking;
  // The server refuses a check-in or no-show before the arrival day too.
  const arrived = isSuiteStayDue(booking, today);

  function save(next: SuiteBookingStatus): void {
    setError(null);
    // Only Check in can be taken back.
    const undoTo = canUndoSuiteBookingStatus(next, status) ? status : null;
    startTransition(async () => {
      try {
        await suiteBookingsApi.update(booking.id, { status: next });
        setConfirming(false);
        toast({
          tone: "success",
          title: t("statusChanged", { reference, status: t(`status.${next}`) }),
          // Confirming or cancelling sends the guest a message (`suiteNotification`).
          description:
            next === "confirmed" || next === "cancelled"
              ? guestToldLine({ name: booking.guestName, phone: booking.guestPhone, userId: booking.userId })
              : undefined,
          onUndo: undoTo ? () => undo(undoTo) : undefined,
        });
      } catch (err) {
        const message = localizeApiError(err, tApiErrors, t("updateError"));
        if (confirming) setError(message);
        else toast({ tone: "error", title: message });
      }
      router.refresh();
    });
  }

  /** The toast's Undo: steps the stay back, with no undo of its own. */
  function undo(to: SuiteBookingStatus): void {
    startTransition(async () => {
      try {
        await suiteBookingsApi.update(booking.id, { status: to, undo: true });
        toast({ tone: "success", title: t("undoneToast", { reference, status: t(`status.${to}`) }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  function ask(next: Ending): void {
    setError(null);
    setEnding(next);
    setConfirming(true);
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
          size="control-md"
          disabled={pending}
          onClick={() => ask("cancelled")}
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
          size="control-md"
          className="px-3"
          loading={pending && !confirming}
          disabled={primary.blockedBy !== null}
          onClick={() => save(primary.next)}
        >
          {primary.label}
        </Button>
      </span>
      {editableSuiteStayDetails(booking).length > 0 ? (
        <DropdownMenu>
          <DropdownMenuIconTrigger
            appearance="secondary"
            disabled={pending}
            aria-label={t("moreActionsAria", { reference })}
          >
            <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
          </DropdownMenuIconTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setEditKey((key) => key + 1);
                setEditing(true);
              }}
            >
              {t("editStay")}
            </DropdownMenuItem>
            {status === "confirmed" && arrived ? (
              <DropdownMenuItem destructive onSelect={() => ask("noShow")}>
                {t("markNoShow")}
              </DropdownMenuItem>
            ) : null}
            {status === "confirmed" ? (
              <DropdownMenuItem destructive onSelect={() => ask("cancelled")}>
                {t("cancelBooking")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <EditStayDialog
        key={editKey}
        open={editing}
        onOpenChange={setEditing}
        booking={booking}
        held={held}
        today={today}
      />

      <DashboardDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`confirmTitle.${ending}`, { reference })}
        subtitle={t("confirmMessage", { name: booking.guestName, range: rangeLabel })}
        submitLabel={ending === "noShow" ? t("markNoShow") : t("cancelBooking")}
        pending={pending}
        onSubmit={() => save(ending)}
        error={error}
        danger
      />
    </div>
  );
}
