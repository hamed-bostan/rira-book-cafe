"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FIELD_ERROR } from "@/src/presentation/dashboard/fieldStyles";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { pricingApi } from "./pricing-api";

type ItemMarkupFieldProps = {
  productId: string;
  /** The item's own target in basis points, or `null` when it uses the default. */
  markupBps: number | null;
  defaultBps: number;
};

/**
 * The item's profit %, edited in place: saved on blur or Enter, blank goes back to
 * the cafe-wide default (shown as the placeholder).
 */
export function ItemMarkupField({ productId, markupBps, defaultBps }: ItemMarkupFieldProps) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const initial = markupBps === null ? "" : String(markupBps / 100);
  const [value, setValue] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(): void {
    const next = value.trim();
    if (next === initial) return;
    setError(null);
    startTransition(async () => {
      try {
        await pricingApi.setItemMarkup(productId, { markup: next });
        toast({ tone: "success", title: t("markupSaved") });
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("markupError")));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          inputMode="decimal"
          placeholder={String(defaultBps / 100)}
          aria-label={t("markupLabel")}
          disabled={pending}
          size="control-md"
          className="w-20"
          inputClassName="border-border-strong px-2 text-end tabular-nums sm:min-h-8 sm:py-1"
          dir="ltr"
        />
        <span className="text-muted-foreground">%</span>
      </div>
      {error ? <FormMessage className={FIELD_ERROR}>{error}</FormMessage> : null}
    </div>
  );
}
