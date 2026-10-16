"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FormMessage, Input } from "@/src/presentation/design-system";

import { inventoryApi } from "./inventory-api";

/** The low-stock level, edited in place: saved on blur or Enter; blank means "never warn". */
export function ReorderLevelField({ id, reorderLevel, unit }: { id: string; reorderLevel?: number; unit: string }) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const initial = reorderLevel === undefined ? "" : String(reorderLevel);
  const [value, setValue] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(): void {
    const next = value.trim();
    if (next === initial) return;
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.setReorderLevel(id, { reorderLevel: next });
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("reorderError")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
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
          placeholder="—"
          aria-label={t("reorderLabel")}
          disabled={pending}
          className="h-9 w-24"
          dir="ltr"
        />
        <span className="text-body-caption text-muted-foreground">{unit}</span>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
