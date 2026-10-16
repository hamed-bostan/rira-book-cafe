"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { ProductBulkAction } from "@/src/contracts/bulk-action-schema";
import type { Category } from "@/src/domain/entities/Category";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useBulkSelection } from "@/src/presentation/dashboard/bulk";
import { Button, Icon, Select } from "@/src/presentation/design-system";

import { productsApi } from "./product-api";

type ProductBulkActionsProps = {
  /** Categories to offer in the "move to" picker. */
  categories: Category[];
};

/**
 * The catalog list's bulk actions: publish, unpublish, and move to a category.
 *
 * No stock or price here, and not by omission — `BulkProductChange` can't express
 * them. Stock has a ledgered path of its own that a bulk edit must not route
 * around, and a price is not a value anyone means to make identical across an
 * arbitrary selection.
 *
 * Each action writes over the API and then `router.refresh()`es, so the rows come
 * back from the server rather than being patched locally; the selection clears
 * because those rows have been replaced.
 *
 * Reads the selection from context rather than taking it as props: the bar around
 * it is rendered from a Server Component, which can't hand a client component a
 * callback (see `BulkActionBar`).
 */
export function ProductBulkActions({ categories }: ProductBulkActionsProps) {
  const t = useTranslations("dashProducts");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { selected, clear } = useBulkSelection();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function apply(action: ProductBulkAction): void {
    setError(null);
    startTransition(async () => {
      try {
        await productsApi.bulkUpdate(selected, action);
        // Re-run the server render so the list reflects the change, then drop the
        // selection — the rows it referred to have just been replaced.
        router.refresh();
        clear();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("bulkError")));
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => apply({ type: "publish" })}>
        <Icon icon={Eye} size="sm" className="me-1.5" />
        {t("bulkPublish")}
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => apply({ type: "unpublish" })}>
        <Icon icon={EyeOff} size="sm" className="me-1.5" />
        {t("bulkUnpublish")}
      </Button>

      {/* Choosing a category *is* the action — there's no separate Apply, since a
          picker that only arms a second button is a click nobody needs. The empty
          option is the resting label, never a submittable value. */}
      <Select
        aria-label={t("bulkAssignCategoryAria")}
        value=""
        disabled={pending}
        onChange={(event) => {
          const categoryId = event.target.value;
          if (categoryId) apply({ type: "assignCategory", categoryId });
        }}
      >
        <option value="">{t("bulkAssignCategory")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>

      {error ? <span className="text-body-small text-destructive">{error}</span> : null}
    </>
  );
}
