"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

import { FIELD_HINT, FIELD_LABEL, TEXT_ACTION } from "../fieldStyles";

/** Something a code can be scoped to: a menu item or a category, by id and the name staff know it by. */
export type PromoScopeOption = { id: string; name: string };

type PromoScopePickerProps = {
  label: string;
  /** Under the list: what choosing none means. */
  hint: string;
  options: readonly PromoScopeOption[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
};

/**
 * Pick any number of menu items (or categories) a promo code is limited to: a
 * search over the names and a checklist (Radix checkboxes), the chosen ones first.
 * A chosen id no longer on the menu still shows — by its id — so it can be taken off.
 */
export function PromoScopePicker({ label, hint, options, selected, onChange }: PromoScopePickerProps) {
  const t = useTranslations("dashPromotions");
  const locale = useLocale();
  const labelId = React.useId();
  const [query, setQuery] = React.useState("");

  const chosen = new Set(selected);
  const known = new Set(options.map((option) => option.id));
  const all: PromoScopeOption[] = [
    ...selected.filter((id) => !known.has(id)).map((id) => ({ id, name: id })),
    ...options,
  ];
  const term = query.trim().toLowerCase();
  const shown = all
    .filter((option) => !term || option.name.toLowerCase().includes(term))
    // The chosen ones first, so what's picked stays in view.
    .sort((a, b) => Number(chosen.has(b.id)) - Number(chosen.has(a.id)));

  function toggle(id: string, on: boolean): void {
    onChange(on ? [...selected, id] : selected.filter((current) => current !== id));
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className={FIELD_LABEL}>
          {label}
        </span>
        {selected.length > 0 ? (
          <button type="button" className={cn(TEXT_ACTION, "text-primary")} onClick={() => onChange([])}>
            {t("scopeClear", { count: selected.length, formatted: formatNumber(selected.length, locale) })}
          </button>
        ) : null}
      </div>
      <Input
        size="control-md"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("scopeSearch")}
        aria-label={t("scopeSearchAria", { label })}
        autoComplete="off"
        dir="auto"
      />
      <ul className="max-h-44 overflow-y-auto rounded-card-md border border-border-strong">
        {shown.length === 0 ? (
          <li className={cn(FIELD_HINT, "px-3 py-2")}>{t("scopeNoMatches")}</li>
        ) : (
          shown.map((option) => {
            const id = `${labelId}-${option.id}`;
            return (
              <li key={option.id} className="border-b border-border last:border-b-0">
                <label
                  htmlFor={id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted sm:min-h-9"
                >
                  <Checkbox
                    id={id}
                    checked={chosen.has(option.id)}
                    onCheckedChange={(checked) => toggle(option.id, checked === true)}
                  />
                  <span dir="auto" className="min-w-0 truncate text-body-default text-foreground sm:text-body-small">
                    {option.name}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
      <span className={FIELD_HINT}>{hint}</span>
    </div>
  );
}
