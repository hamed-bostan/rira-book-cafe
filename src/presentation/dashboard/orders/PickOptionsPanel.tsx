"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { defaultChoiceIds, optionSelectionProblem, priceWithChoices } from "@/src/domain/entities/ProductOptions";
import { formatMoney } from "@/src/lib/formatMoney";
import { FIELD_HINT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ProductOptionsPicker } from "@/src/presentation/product/ProductOptionsPicker";

import type { MenuPick } from "./pickedLines";

type PickOptionsPanelProps = {
  product: MenuPick;
  onAdd: (choiceIds: string[]) => void;
  onCancel: () => void;
};

/**
 * Staff choosing an item's options before it goes on a sale or a round: the
 * guest's choices, starting from the defaults, the price they come to, and Add —
 * which waits until every required group is answered, as the guest's page does.
 * Opens in place under the item, so it works the same in a dialog and on a phone.
 */
export function PickOptionsPanel({ product, onAdd, onCancel }: PickOptionsPanelProps) {
  const t = useTranslations("productOptions");
  const locale = useLocale();
  const groups = product.optionGroups ?? [];
  const [choiceIds, setChoiceIds] = React.useState<string[]>(() => defaultChoiceIds(groups));
  const incomplete = optionSelectionProblem(groups, choiceIds) !== null;

  return (
    <div
      role="group"
      aria-label={t("pickTitle", { name: product.name })}
      className="flex flex-col gap-4 border-t border-border bg-canvas px-4 py-4"
    >
      <p dir="auto" className={FIELD_LABEL}>
        {t("pickTitle", { name: product.name })}
      </p>
      <ProductOptionsPicker groups={groups} value={choiceIds} onChange={setChoiceIds} />
      {incomplete ? <p className={FIELD_HINT}>{t("incomplete")}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={onCancel}>
          {t("pickCancel")}
        </Button>
        <Button type="button" size="control-md" className="px-3" disabled={incomplete} onClick={() => onAdd(choiceIds)}>
          {t("pickAdd", { price: formatMoney(priceWithChoices(product, choiceIds), locale) })}
        </Button>
      </div>
    </div>
  );
}
