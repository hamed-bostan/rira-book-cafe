"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { pointsEarnedFor, pointsValue, type LoyaltySettings } from "@/src/domain/entities/Loyalty";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { FIELD_HINT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { promotionsApi } from "./promotion-api";

const NUMBER_FIELDS = ["tomanPerPoint", "pointValue", "minRedeemPoints"] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];

/** What each field's box suggests while empty. */
const PLACEHOLDER: Record<NumberField, string> = { tomanPerPoint: "10000", pointValue: "1000", minRedeemPoints: "50" };

/** The order, in Toman, the worked example earns points on. */
const EXAMPLE_ORDER = 250_000;

/** The form as typed: the switch, and the three numbers as their inputs hold them. */
type ClubForm = { enabled: boolean } & Record<NumberField, string>;

function toForm(settings: LoyaltySettings): ClubForm {
  return {
    enabled: settings.enabled,
    tomanPerPoint: String(settings.tomanPerPoint),
    pointValue: String(settings.pointValue),
    minRedeemPoints: String(settings.minRedeemPoints),
  };
}

/** The typed rules, or `null` until they're whole numbers — at least 1 to earn and to spend, 0 or more for the minimum. */
function parse(form: ClubForm): LoyaltySettings | null {
  const [tomanPerPoint, pointValue, minRedeemPoints] = NUMBER_FIELDS.map((field) =>
    form[field].trim() === "" ? Number.NaN : Number(form[field]),
  );
  const whole = (value: number, least: number): boolean => Number.isInteger(value) && value >= least;
  return whole(tomanPerPoint, 1) && whole(pointValue, 1) && whole(minRedeemPoints, 0)
    ? { enabled: form.enabled, tomanPerPoint, pointValue, minRedeemPoints }
    : null;
}

/**
 * How the rewards club works: on or paused, how much a guest spends for a point,
 * what a point takes off, and the fewest they can spend — with a worked example
 * that follows the numbers as they're typed. Discard puts back what's saved; Save
 * writes over the REST API and `router.refresh()`es.
 */
export function LoyaltySettingsForm({ settings }: { settings: LoyaltySettings }) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const switchId = React.useId();

  const [form, setForm] = React.useState<ClubForm>(() => toForm(settings));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const saved = toForm(settings);
  const dirty = (Object.keys(saved) as (keyof ClubForm)[]).some((key) => form[key] !== saved[key]);
  const rules = parse(form);

  function set<K extends keyof ClubForm>(key: K, value: ClubForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function example(): string {
    if (!form.enabled) return t("clubPaused");
    if (!rules) return t("clubIncomplete");
    const earned = pointsEarnedFor(EXAMPLE_ORDER, rules);
    return t("clubExample", {
      order: formatMoney(EXAMPLE_ORDER, locale),
      count: earned,
      formatted: formatNumber(earned, locale),
      worth: formatMoney(pointsValue(earned, rules), locale),
    });
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (!dirty) return;
    if (!rules) {
      setError(t("clubInvalid"));
      return;
    }
    startTransition(async () => {
      try {
        setForm(toForm(await promotionsApi.saveLoyaltySettings(rules)));
        toast({ tone: "success", title: t("clubSaved") });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof ApiError && err.fieldErrors
            ? t("clubInvalid")
            : localizeApiError(err, tApiErrors, t("saveError")),
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <label htmlFor={switchId} className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-8">
        <Switch id={switchId} size="sm" checked={form.enabled} onCheckedChange={(checked) => set("enabled", checked)} />
        <span className="flex flex-col">
          <span className={FIELD_LABEL}>{t("clubOn")}</span>
          <span className={FIELD_HINT}>{form.enabled ? t("clubOnHint") : t("clubOffHint")}</span>
        </span>
      </label>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
        {NUMBER_FIELDS.map((field) => (
          <DashboardField key={field} label={t(`club.${field}`)} hint={t(`clubHint.${field}`)}>
            <Input
              size="control-md"
              value={form[field]}
              onChange={(event) => set(field, event.target.value)}
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              placeholder={PLACEHOLDER[field]}
            />
          </DashboardField>
        ))}
      </div>

      <p className="rounded-button bg-muted px-4 py-3 text-body-default text-pretty text-foreground/80 sm:text-body-small">
        {example()}
      </p>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="px-3"
            disabled={pending}
            onClick={() => {
              setForm(saved);
              setError(null);
            }}
          >
            {t("discard")}
          </Button>
        ) : null}
        <Button type="submit" size="control-md" className="px-4" loading={pending} disabled={!dirty}>
          {t("saveChanges")}
        </Button>
      </div>
    </form>
  );
}
