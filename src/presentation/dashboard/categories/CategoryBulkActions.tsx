"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { CategoryBulkAction } from "@/src/contracts/bulk-action-schema";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useBulkSelection } from "@/src/presentation/dashboard/bulk";
import { Button, Icon } from "@/src/presentation/design-system";

import { categoriesApi } from "./category-api";

/**
 * The category list's bulk actions: activate and deactivate. No bulk delete —
 * deleting a category is destructive and rare enough to stay a per-row confirm
 * (see `DeleteCategoryButton`), so there's no action here for it.
 *
 * Mirrors `ProductBulkActions`: each action writes over the API and then
 * `router.refresh()`es, so the rows come back from the server rather than being
 * patched locally; the selection clears because those rows have been replaced.
 *
 * Reads the selection from context rather than taking it as props: the bar
 * around it is rendered from a Server Component, which can't hand a client
 * component a callback (see `BulkActionBar`).
 */
export function CategoryBulkActions() {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { selected, clear } = useBulkSelection();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function apply(action: CategoryBulkAction): void {
    setError(null);
    startTransition(async () => {
      try {
        await categoriesApi.bulkUpdate(selected, action);
        router.refresh();
        clear();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("bulkError")));
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => apply({ type: "activate" })}>
        <Icon icon={Check} size="sm" className="me-1.5" />
        {t("bulkActivate")}
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => apply({ type: "deactivate" })}>
        <Icon icon={X} size="sm" className="me-1.5" />
        {t("bulkDeactivate")}
      </Button>

      {error ? <span className="text-body-small text-destructive">{error}</span> : null}
    </>
  );
}
