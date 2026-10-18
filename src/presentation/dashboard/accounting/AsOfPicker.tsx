"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

/** The day a point-in-time statement (trial balance, balance sheet) is read at. */
export function AsOfPicker({ asOfDay }: { asOfDay: string }) {
  const t = useTranslations("dashAccounting");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [day, setDay] = React.useState(asOfDay);
  const today = cafeDayOf(new Date());

  function go(next: string): void {
    setDay(next);
    router.push(next === today ? pathname : `${pathname}?asOf=${next}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (day) go(day);
      }}
    >
      <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
        {t("period.asOf")}
        <Input
          type="date"
          value={day}
          max={today}
          onChange={(event) => setDay(event.target.value)}
          className="h-9"
          dir="ltr"
        />
      </label>
      <Button type="submit" size="sm" disabled={!day}>
        {t("period.apply")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => go(today)}>
        {t("period.today")}
      </Button>
      <span className="w-full text-body-caption text-muted-foreground">{formatCafeDayMedium(asOfDay, locale)}</span>
    </form>
  );
}
