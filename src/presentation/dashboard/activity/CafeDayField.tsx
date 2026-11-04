"use client";

import { useLocale } from "next-intl";

import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

import { JalaliDayField } from "./JalaliDayField";

export type CafeDayFieldProps = {
  /** The day picked, as a cafe day (`YYYY-MM-DD`, Gregorian), or "" for none. */
  value: string;
  onChange: (day: string) => void;
  /** The field's visible label. */
  label: string;
};

/**
 * One day, on the reader's calendar: the Persian (Jalali) calendar in Persian —
 * browsers' date pickers are Gregorian-only — and the browser's own date input in
 * English. Either way the value is a cafe day.
 */
export function CafeDayField({ value, onChange, label }: CafeDayFieldProps) {
  const locale = useLocale();
  if (locale === "fa") return <JalaliDayField value={value} onChange={onChange} label={label} />;
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-body-default font-medium text-foreground sm:text-body-small">{label}</span>
      <Input size="control-md" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
