"use client";

import { Armchair } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import * as React from "react";

import type { EventTableOption } from "@/src/domain/entities/CafeEvent";
import { inFloorOrder } from "@/src/domain/entities/CafeTable";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatEventTime } from "@/src/lib/formatEventWhen";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { tableNameValues } from "../floor/tableName";

import { eventsApi } from "./event-api";
import { TableFit } from "./TableFit";

type HoldTablesButtonProps = {
  eventId: string;
  title: string;
  /** "Thu, Oct 22 · 5:00 PM – 7:00 PM · 12 seats. Held tables…", already formatted. */
  subtitle: string;
  capacity: number | undefined;
  /** Whether the event holds any tables now — "Change tables" rather than "Hold tables". */
  hasTables: boolean;
};

/** Placeholder tiles drawn while the floor loads — one per table on the plan. */
const LOADING_TILES = 9;

/**
 * "Hold tables" on an event card: a picker of the floor's tables, read fresh when
 * it opens (bookings move all day). Tables a guest booked or another event holds
 * at that time can't be chosen. Saves over the REST API, then `router.refresh()`es.
 */
export function HoldTablesButton({ eventId, title, subtitle, capacity, hasTables }: HoldTablesButtonProps) {
  const t = useTranslations("dashEvents");
  const tFloor = useTranslations("floorTables");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<EventTableOption[] | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(async (): Promise<void> => {
    setLoadFailed(false);
    try {
      const fresh = await eventsApi.listTables(eventId);
      setOptions(fresh);
      setPicked(fresh.filter((option) => option.held).map((option) => option.label));
    } catch {
      setLoadFailed(true);
    }
  }, [eventId]);

  function openChange(next: boolean): void {
    setOpen(next);
    if (next) {
      setOptions(null);
      setError(null);
      void load();
    }
  }

  const free = (options ?? []).filter((option) => !option.clash).map((option) => option.label);
  const allPicked = free.length > 0 && free.every((label) => picked.includes(label));

  function toggle(label: string, on: boolean): void {
    setPicked((current) => (on ? [...current, label] : current.filter((other) => other !== label)));
  }

  function clashText(option: EventTableOption): string {
    if (!option.clash) return tFloor("seats", { seats: formatNumber(option.seats, locale) });
    if (option.clash.kind === "booking") {
      return t("tableBooked", {
        reference: option.clash.reference,
        time: formatEventTime(option.clash.startsAt, locale),
      });
    }
    return t("tableHeldBy", { title: option.clash.title });
  }

  function save(): void {
    setError(null);
    const tableLabels = inFloorOrder(picked);
    startTransition(async () => {
      try {
        await eventsApi.holdTables(eventId, { tableLabels });
        toast({
          tone: "success",
          title: tableLabels.length ? t("tablesSaved", { title }) : t("tablesReleased", { title }),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        // Someone booked one of the tables since the picker opened: show the floor as it is now.
        if (err instanceof ApiError && err.status === 409) await load();
        setError(localizeApiError(err, tApiErrors, t("tablesSaveError")));
      }
    });
  }

  return (
    <Modal open={open} onOpenChange={openChange}>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        onClick={() => openChange(true)}
        className="gap-2 px-3"
      >
        <Icon icon={Armchair} size="sm" />
        {hasTables ? t("changeTables") : t("holdTables")}
      </Button>

      <ModalContent
        title={t("holdTitle", { title })}
        className="flex max-h-[calc(100dvh-2rem)] max-w-md flex-col gap-5 overflow-y-auto"
        titleClassName="text-start text-body-lead"
      >
        <p className="-mt-4 text-body-default text-muted-foreground sm:text-body-small">{subtitle}</p>

        {loadFailed ? (
          <div className="flex flex-col items-start gap-3">
            <FormMessage>{t("tablesLoadError")}</FormMessage>
            <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => void load()}>
              {t("tryAgain")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              {picked.length > 0 ? (
                <TableFit tableLabels={picked} capacity={capacity} />
              ) : (
                <p className="text-body-small font-medium text-muted-foreground sm:text-body-caption">
                  {t("noTablesSelected")}
                </p>
              )}
              <button
                type="button"
                disabled={!options || free.length === 0}
                onClick={() => setPicked(allPicked ? [] : free)}
                // 44px to the touch on a phone without moving the row.
                className={cn(
                  "-my-3 shrink-0 py-3 text-body-default font-medium whitespace-nowrap text-primary transition-colors hover:text-primary-hover disabled:text-disabled-foreground sm:my-0 sm:py-0 sm:text-body-small",
                  focusRing,
                )}
              >
                {allPicked ? t("clearAll") : t("selectAllFree")}
              </button>
            </div>

            <div role="group" aria-label={t("tablesHeld")} className="grid grid-cols-3 gap-2">
              {options
                ? options.map((option) => {
                    const on = picked.includes(option.label);
                    return (
                      <CheckboxPrimitive.Root
                        key={option.label}
                        checked={on}
                        disabled={option.clash !== undefined}
                        onCheckedChange={(checked) => toggle(option.label, checked === true)}
                        className={cn(
                          "flex min-h-12 min-w-0 flex-col items-start gap-0.5 rounded-button border-2 px-3 py-2 text-start text-foreground transition-colors",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                          on ? "border-primary bg-accent" : "border-border bg-background hover:border-border-strong",
                          focusRing,
                        )}
                      >
                        <span className="text-body-default font-semibold sm:text-body-small">
                          {tFloor("tableName", tableNameValues(option.label, locale))}
                        </span>
                        <span
                          className={cn(
                            "max-w-full truncate text-body-small sm:text-body-caption",
                            option.clash?.kind === "booking"
                              ? "text-error-foreground"
                              : option.clash?.kind === "event"
                                ? "text-info-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {clashText(option)}
                        </span>
                      </CheckboxPrimitive.Root>
                    );
                  })
                : Array.from({ length: LOADING_TILES }, (_, index) => (
                    <Skeleton key={index} className="h-14 rounded-button" />
                  ))}
            </div>
          </div>
        )}

        {error ? <FormMessage>{error}</FormMessage> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => setOpen(false)}>
            {t("back")}
          </Button>
          <Button type="button" size="control-md" className="px-4" disabled={!options || pending} onClick={save}>
            {t("saveTables")}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
