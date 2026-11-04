"use client";

import { useLocale, useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";

import { choiceBounds, localizedName, type ProductOptionGroup } from "@/src/domain/entities/ProductOptions";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { ProductOptionChoiceLabel } from "./ProductOptionChoiceLabel";

type ProductOptionsPickerProps = {
  groups: readonly ProductOptionGroup[];
  /** The ids of the choices made, in any order. */
  value: readonly string[];
  onChange: (choiceIds: string[]) => void;
  disabled?: boolean;
};

/** One choice row: the whole row is the target, so it's a comfortable tap on a phone. */
const CHOICE_ROW =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-button border border-border px-3 py-2 text-start transition-colors hover:bg-muted data-[state=checked]:border-primary has-[[data-state=checked]]:border-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

/**
 * Choosing an item's options — a size, extras — on the guest's item page and at
 * staff's pickers alike. A single-choice group is a radio group (an optional one
 * can be cleared by choosing its choice again); a multiple-choice one is a set of
 * checkboxes that stops taking more at its most. A choice switched off shows, but
 * can't be chosen. Each group says what it needs; the caller checks the whole
 * selection (`optionSelectionProblem`) before it adds the line.
 */
export function ProductOptionsPicker({ groups, value, onChange, disabled = false }: ProductOptionsPickerProps) {
  const t = useTranslations("productOptions");
  const locale = useLocale();
  const chosen = new Set(value);

  function replaceGroup(group: ProductOptionGroup, ids: readonly string[]): void {
    const others = value.filter((id) => !group.choices.some((choice) => choice.id === id));
    onChange([...others, ...ids]);
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const { min, max } = choiceBounds(group);
        const picked = group.choices.filter((choice) => chosen.has(choice.id)).map((choice) => choice.id);
        const name = localizedName(group.name, group.nameFa, locale);
        const hint =
          group.selection === "single"
            ? t(group.required ? "chooseOne" : "chooseUpToOne")
            : min > 0 && min === max
              ? t("chooseExactly", { count: formatNumber(min, locale) })
              : min > 0
                ? t("chooseBetween", { min: formatNumber(min, locale), max: formatNumber(max, locale) })
                : t("chooseUpTo", { count: formatNumber(max, locale) });
        const legendId = `option-group-${group.id}`;
        return (
          <fieldset key={group.id} className="flex flex-col gap-2" aria-labelledby={legendId}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span id={legendId} dir="auto" className="text-body-small-strong text-foreground">
                {name}
              </span>
              <span className="text-body-caption text-muted-foreground">
                {group.required ? t("required") : t("optional")} · {hint}
              </span>
            </div>
            {group.selection === "single" ? (
              <RadioGroupPrimitive.Root
                aria-labelledby={legendId}
                aria-required={group.required || undefined}
                value={picked[0] ?? ""}
                onValueChange={(id) => replaceGroup(group, [id])}
                disabled={disabled}
                className="flex flex-col gap-2"
              >
                {group.choices.map((choice) => (
                  <RadioGroupPrimitive.Item
                    key={choice.id}
                    value={choice.id}
                    disabled={!choice.isAvailable}
                    onClick={() => {
                      // An optional size can be taken back by choosing it again.
                      if (!group.required && chosen.has(choice.id)) replaceGroup(group, []);
                    }}
                    className={cn(CHOICE_ROW, focusRing)}
                  >
                    <span
                      aria-hidden
                      className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong"
                    >
                      <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
                    </span>
                    <ProductOptionChoiceLabel
                      name={localizedName(choice.name, choice.nameFa, locale)}
                      priceDelta={choice.priceDelta}
                      available={choice.isAvailable}
                      locale={locale}
                    />
                  </RadioGroupPrimitive.Item>
                ))}
              </RadioGroupPrimitive.Root>
            ) : (
              <div className="flex flex-col gap-2">
                {group.choices.map((choice) => {
                  const on = chosen.has(choice.id);
                  const blocked = disabled || !choice.isAvailable || (!on && picked.length >= max);
                  const id = `option-choice-${choice.id}`;
                  return (
                    <label key={choice.id} htmlFor={id} aria-disabled={blocked || undefined} className={CHOICE_ROW}>
                      <Checkbox
                        id={id}
                        checked={on}
                        disabled={blocked}
                        onCheckedChange={(next) =>
                          replaceGroup(
                            group,
                            next === true ? [...picked, choice.id] : picked.filter((p) => p !== choice.id),
                          )
                        }
                      />
                      <ProductOptionChoiceLabel
                        name={localizedName(choice.name, choice.nameFa, locale)}
                        priceDelta={choice.priceDelta}
                        available={choice.isAvailable}
                        locale={locale}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
