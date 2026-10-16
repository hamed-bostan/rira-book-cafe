"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { usePathname, useRouter } from "@/src/i18n/navigation";
import { Button, Input } from "@/src/presentation/design-system";

/** The day being counted. Changing it re-reads that day's figures from the server. */
export function CashDayPicker({ day, today }: { day: string; today: string }) {
  const t = useTranslations("dashCash");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = React.useState(day);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) router.push(`${pathname}?day=${value}`);
      }}
    >
      <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
        {t("dayLabel")}
        <Input type="date" value={value} max={today} onChange={(event) => setValue(event.target.value)} className="h-9" dir="ltr" />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={!value || value === day}>
        {t("showDay")}
      </Button>
    </form>
  );
}
