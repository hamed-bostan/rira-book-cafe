"use client";

import { useLocale, useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import type { TableChoice } from "@/src/domain/entities/FloorAvailability";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { tableNameValues } from "../floor/tableName";

type TableChoiceGridProps = {
  choices: readonly TableChoice[];
  /** The table picked, or `null` for none. */
  value: string | null;
  onChange: (label: string | null) => void;
  /** Lets a second click on the picked table clear it — an optional choice (a new booking). */
  clearable?: boolean;
};

/**
 * The floor as a 3-column grid of tables to pick one from. A table another
 * booking or an event has then, or one too small for the party, is shown but
 * can't be chosen, with the reason under its name.
 */
export function TableChoiceGrid({ choices, value, onChange, clearable = false }: TableChoiceGridProps) {
  const t = useTranslations("dashReservations");
  const tFloor = useTranslations("floorTables");
  const locale = useLocale();

  function reason(choice: TableChoice): string {
    const seats = formatNumber(choice.seats, locale);
    switch (choice.block?.kind) {
      case "booking":
        return t("tableTaken", { reference: choice.block.reference });
      case "event":
        return t("tableHeld", { title: choice.block.title });
      case "tooSmall":
        return t("tableTooSmall", { seats });
      default:
        return tFloor("seats", { seats });
    }
  }

  return (
    <RadioGroupPrimitive.Root
      aria-label={t("tableGroupLabel")}
      value={value ?? ""}
      onValueChange={(label) => onChange(label)}
      className="grid grid-cols-3 gap-2"
    >
      {choices.map((choice) => {
        const on = choice.label === value;
        return (
          <RadioGroupPrimitive.Item
            key={choice.label}
            value={choice.label}
            disabled={choice.block !== undefined}
            onClick={() => {
              if (clearable && on) onChange(null);
            }}
            className={cn(
              "flex min-h-12 min-w-0 flex-col items-start gap-0.5 rounded-button border-2 px-3 py-2 text-start text-foreground transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-40",
              on ? "border-primary bg-accent" : "border-border bg-background hover:border-border-strong",
              focusRing,
            )}
          >
            <span className="text-body-default font-semibold sm:text-body-small">
              {tFloor("tableName", tableNameValues(choice.label, locale))}
            </span>
            <span
              className={cn(
                "max-w-full truncate text-body-small sm:text-body-caption",
                choice.block?.kind === "booking"
                  ? "text-error-foreground"
                  : choice.block?.kind === "event"
                    ? "text-info-foreground"
                    : "text-muted-foreground",
              )}
            >
              {reason(choice)}
            </span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
