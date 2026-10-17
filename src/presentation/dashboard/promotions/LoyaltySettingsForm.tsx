"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { LoyaltySettings } from "@/src/domain/entities/Loyalty";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage, Input, Switch } from "@/src/presentation/design-system";

import { promotionsApi } from "./promotion-api";

const NUMBER_FIELDS = ["tomanPerPoint", "pointValue", "minRedeemPoints"] as const;

/** How the loyalty club works: on or off, how points are earned, what they're worth, the least a guest can spend. */
export function LoyaltySettingsForm({ settings }: { settings: LoyaltySettings }) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(settings.enabled);
  const [numbers, setNumbers] = React.useState<Record<(typeof NUMBER_FIELDS)[number], string>>({
    tomanPerPoint: String(settings.tomanPerPoint),
    pointValue: String(settings.pointValue),
    minRedeemPoints: String(settings.minRedeemPoints),
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = Object.fromEntries(NUMBER_FIELDS.map((field) => [field, Number(numbers[field])])) as Record<(typeof NUMBER_FIELDS)[number], number>;
    if (NUMBER_FIELDS.some((field) => !Number.isInteger(parsed[field]) || parsed[field] < (field === "minRedeemPoints" ? 0 : 1))) {
      setError(t("loyaltyInvalid"));
      return;
    }
    startTransition(async () => {
      try {
        await promotionsApi.saveLoyaltySettings({ enabled, ...parsed });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("saveError")));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 text-body-small-emphasis text-foreground">
        {t("loyaltyEnabled")}
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {NUMBER_FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
            {t(`loyalty.${field}`)}
            <Input
              value={numbers[field]}
              onChange={(event) => setNumbers((current) => ({ ...current, [field]: event.target.value }))}
              inputMode="numeric"
              dir="ltr"
              required
            />
            <span className="text-body-caption font-normal text-muted-foreground">{t(`loyaltyHint.${field}`)}</span>
          </label>
        ))}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {saved ? <p className="text-body-small text-success-foreground">{t("saved")}</p> : null}
      <Button type="submit" size="sm" className="self-end" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
