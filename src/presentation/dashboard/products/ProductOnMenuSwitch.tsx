"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { productsApi } from "./product-api";

type ProductOnMenuSwitchProps = {
  id: string;
  name: string;
  isPublished: boolean;
};

/**
 * A row's "On menu" switch: on, guests can see and order the item; off, it's
 * hidden from the menu but kept, with its past orders. Writes over the REST API
 * and `router.refresh()`es. The label around it — switch and state word — is the
 * touch target, 44px tall on a phone.
 */
export function ProductOnMenuSwitch({ id, name, isPublished }: ProductOnMenuSwitchProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const switchId = React.useId();

  /** `undoable` is off for the undo itself, so its toast doesn't offer to undo the undo. */
  function toggle(next: boolean, undoable = true): void {
    startTransition(async () => {
      try {
        await productsApi.bulkUpdate([id], { type: next ? "publish" : "unpublish" });
        toast({
          tone: "success",
          title: next ? t("shownToast", { name }) : t("hiddenToast", { name }),
          onUndo: undoable ? () => toggle(!next, false) : undefined,
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("updateError")) });
      }
      router.refresh();
    });
  }

  return (
    <label htmlFor={switchId} className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-8">
      <Switch
        id={switchId}
        size="sm"
        checked={isPublished}
        disabled={pending}
        onCheckedChange={(next) => toggle(next)}
        aria-label={t("onMenuAria", { name })}
      />
      <span className="text-body-default whitespace-nowrap text-foreground/80 sm:text-body-small">
        {isPublished ? t("onMenu") : t("hidden")}
      </span>
    </label>
  );
}
