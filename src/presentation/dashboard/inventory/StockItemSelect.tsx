"use client";

import { useLocale, useTranslations } from "next-intl";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

import { formatStockQuantity } from "./stockFormat";

type StockItemSelectProps = {
  items: readonly StockItem[];
  value: string;
  onChange: (id: string) => void;
};

/** Which stock item a dialog acts on, each option showing what's on hand. */
export function StockItemSelect({ items, value, onChange }: StockItemSelectProps) {
  const t = useTranslations("dashInventory");
  const locale = useLocale();

  return (
    <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
      {t("quick.itemLabel")}
      <Select value={value} onChange={(event) => onChange(event.target.value)} required>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {t("quick.itemOption", {
              name: item.name,
              quantity: formatStockQuantity(item.onHand, locale),
              unit: t(`unit.${item.unit}`),
            })}
          </option>
        ))}
      </Select>
    </label>
  );
}
