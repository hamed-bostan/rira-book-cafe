"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

import { DashboardField } from "../DashboardField";
import { FIELD_INPUT } from "../fieldStyles";
import { ROW_CAPTION } from "../pageStyles";

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
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (day) go(day);
      }}
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <DashboardField label={t("period.asOf")}>
          <Input
            size="control-md"
            type="date"
            value={day}
            max={today}
            onChange={(event) => setDay(event.target.value)}
            className="w-auto"
            inputClassName={FIELD_INPUT}
            dir="ltr"
          />
        </DashboardField>
        <Button type="submit" variant="secondary" size="control-md" className="px-3" disabled={!day}>
          {t("period.apply")}
        </Button>
        <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => go(today)}>
          {t("period.today")}
        </Button>
      </div>
      <p className={ROW_CAPTION}>{formatCafeDayMedium(asOfDay, locale)}</p>
    </form>
  );
}
