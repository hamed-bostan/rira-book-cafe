"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  Controller,
  useFormState,
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import type { ProductFormInput } from "@/src/contracts/product-schema";
import { MAX_OPTION_NAME_LENGTH } from "@/src/domain/entities/ProductOptions";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { FIELD_INPUT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { RemoveLineButton } from "@/src/presentation/dashboard/RemoveLineButton";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";

type ProductOptionChoiceFieldsProps = {
  control: Control<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  getValues: UseFormGetValues<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  groupIndex: number;
  index: number;
  count: number;
  /** Only a required single-choice group has a default. */
  showDefault: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
};

/**
 * One choice of an option group: its names, what it adds to the price, whether it
 * can be had now, and — in a required single-choice group — whether it's the
 * default (ticking one unticks the rest). Stacked on a phone, one row from `lg`.
 */
export function ProductOptionChoiceFields({
  control,
  register,
  getValues,
  setValue,
  groupIndex,
  index,
  count,
  showDefault,
  onMove,
  onRemove,
}: ProductOptionChoiceFieldsProps) {
  const t = useTranslations("dashProducts");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const { errors } = useFormState({ control, name: `optionGroups.${groupIndex}.choices.${index}` });
  const choiceErrors = errors.optionGroups?.[groupIndex]?.choices?.[index];
  const names = { number: formatNumber(index + 1, locale), group: formatNumber(groupIndex + 1, locale) };
  const availableId = React.useId();
  const defaultId = React.useId();

  /** Make this the group's one default, or take it away. */
  function setDefault(on: boolean): void {
    const choices = getValues(`optionGroups.${groupIndex}.choices`) ?? [];
    choices.forEach((_, other) => {
      setValue(`optionGroups.${groupIndex}.choices.${other}.isDefault`, on && other === index, { shouldDirty: true });
    });
  }

  return (
    <li className="grid grid-cols-1 gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
      <DashboardFormField label={t("optionChoiceName")} required error={fieldError(choiceErrors?.name?.message)}>
        {(wiring) => (
          <Input
            {...wiring}
            {...register(`optionGroups.${groupIndex}.choices.${index}.name`)}
            size="control-md"
            inputClassName={FIELD_INPUT}
            maxLength={MAX_OPTION_NAME_LENGTH}
            dir="ltr"
            placeholder={t("optionChoiceNamePlaceholder")}
          />
        )}
      </DashboardFormField>
      <DashboardFormField label={t("optionChoiceNameFa")} error={fieldError(choiceErrors?.nameFa?.message)}>
        {(wiring) => (
          <Input
            {...wiring}
            {...register(`optionGroups.${groupIndex}.choices.${index}.nameFa`)}
            size="control-md"
            inputClassName={FIELD_INPUT}
            maxLength={MAX_OPTION_NAME_LENGTH}
            dir="rtl"
            placeholder={t("optionChoiceNameFaPlaceholder")}
          />
        )}
      </DashboardFormField>
      <DashboardFormField label={t("optionChoicePrice")} error={fieldError(choiceErrors?.priceDelta?.message)}>
        {(wiring) => (
          <Input
            {...wiring}
            {...register(`optionGroups.${groupIndex}.choices.${index}.priceDelta`)}
            size="control-md"
            inputClassName={FIELD_INPUT}
            inputMode="numeric"
            placeholder="0"
          />
        )}
      </DashboardFormField>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-3">
        <Controller
          control={control}
          name={`optionGroups.${groupIndex}.choices.${index}.isAvailable`}
          render={({ field }) => (
            <label htmlFor={availableId} className="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-8">
              <Switch
                id={availableId}
                size="sm"
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label={t("optionChoiceAvailableAria", names)}
              />
              <span className={FIELD_LABEL}>{t("optionChoiceAvailable")}</span>
            </label>
          )}
        />
        {showDefault ? (
          <Controller
            control={control}
            name={`optionGroups.${groupIndex}.choices.${index}.isDefault`}
            render={({ field }) => (
              <label htmlFor={defaultId} className="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-8">
                <Checkbox
                  id={defaultId}
                  checked={field.value}
                  onCheckedChange={(checked) => setDefault(checked === true)}
                  aria-label={t("optionChoiceDefaultAria", names)}
                />
                <span className={FIELD_LABEL}>{t("optionChoiceDefault")}</span>
              </label>
            )}
          />
        ) : null}
        <span className="ms-auto flex items-center">
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            iconOnly
            className="border-0 bg-transparent"
            disabled={index === 0}
            aria-label={t("moveOptionChoiceUp", names)}
            title={t("moveOptionChoiceUp", names)}
            onClick={() => onMove(index - 1)}
          >
            <Icon icon={ArrowUp} size="icon-md" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            iconOnly
            className="border-0 bg-transparent"
            disabled={index === count - 1}
            aria-label={t("moveOptionChoiceDown", names)}
            title={t("moveOptionChoiceDown", names)}
            onClick={() => onMove(index + 1)}
          >
            <Icon icon={ArrowDown} size="icon-md" />
          </Button>
          <RemoveLineButton label={t("removeOptionChoice", names)} disabled={count === 1} onClick={onRemove} />
        </span>
      </div>
    </li>
  );
}
