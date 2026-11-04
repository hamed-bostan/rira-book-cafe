"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import type { ProductFormInput } from "@/src/contracts/product-schema";
import { MAX_OPTION_CHOICES, MAX_OPTION_NAME_LENGTH } from "@/src/domain/entities/ProductOptions";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { FIELD_ERROR, FIELD_INPUT, FIELD_LABEL, OVERLINE } from "@/src/presentation/dashboard/fieldStyles";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { RemoveLineButton } from "@/src/presentation/dashboard/RemoveLineButton";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { ProductOptionChoiceFields } from "./ProductOptionChoiceFields";

type ProductOptionGroupFieldsProps = {
  control: Control<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  getValues: UseFormGetValues<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  index: number;
  /** How many groups there are, so the last can't move further down. */
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
};

/** A blank choice, available, not the default. */
const NEW_CHOICE = { name: "", nameFa: "", priceDelta: "", isAvailable: true, isDefault: false };

/**
 * One option group in the product form: its names in both languages, whether
 * guests pick one or several (and, for several, how many), whether it's required,
 * and its choices in order. Stacks on a phone; the choices' fields share rows from
 * `sm` up.
 */
export function ProductOptionGroupFields({
  control,
  register,
  getValues,
  setValue,
  index,
  count,
  onMove,
  onRemove,
}: ProductOptionGroupFieldsProps) {
  const t = useTranslations("dashProducts");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const number = formatNumber(index + 1, locale);
  const headingId = React.useId();
  const { fields, append, remove, move } = useFieldArray({ control, name: `optionGroups.${index}.choices` });
  const { errors } = useFormState({ control, name: `optionGroups.${index}` });
  const groupErrors = errors.optionGroups?.[index];
  const selection = useWatch({ control, name: `optionGroups.${index}.selection` });
  const required = useWatch({ control, name: `optionGroups.${index}.required` });
  const choicesError = fieldError(groupErrors?.choices?.message ?? groupErrors?.choices?.root?.message);

  return (
    <fieldset
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-card-lg border border-border-strong p-4"
      data-testid="option-group"
    >
      <div className="flex items-center gap-2">
        <span id={headingId} className={`${OVERLINE} flex-1`}>
          {t("optionGroupLabel", { number })}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          iconOnly
          className="border-0 bg-transparent"
          disabled={index === 0}
          aria-label={t("moveOptionGroupUp", { number })}
          title={t("moveOptionGroupUp", { number })}
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
          aria-label={t("moveOptionGroupDown", { number })}
          title={t("moveOptionGroupDown", { number })}
          onClick={() => onMove(index + 1)}
        >
          <Icon icon={ArrowDown} size="icon-md" />
        </Button>
        <RemoveLineButton label={t("removeOptionGroup", { number })} onClick={onRemove} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DashboardFormField label={t("optionGroupName")} required error={fieldError(groupErrors?.name?.message)}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register(`optionGroups.${index}.name`)}
              size="control-md"
              inputClassName={FIELD_INPUT}
              maxLength={MAX_OPTION_NAME_LENGTH}
              dir="ltr"
              placeholder={t("optionGroupNamePlaceholder")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("optionGroupNameFa")} error={fieldError(groupErrors?.nameFa?.message)}>
          {(wiring) => (
            <Input
              {...wiring}
              {...register(`optionGroups.${index}.nameFa`)}
              size="control-md"
              inputClassName={FIELD_INPUT}
              maxLength={MAX_OPTION_NAME_LENGTH}
              dir="rtl"
              placeholder={t("optionGroupNameFaPlaceholder")}
            />
          )}
        </DashboardFormField>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{t("optionSelection")}</span>
        <Controller
          control={control}
          name={`optionGroups.${index}.selection`}
          render={({ field }) => (
            <OverviewSegmented
              label={t("optionSelection")}
              value={field.value}
              onChange={field.onChange}
              fill
              options={[
                { value: "single", label: t("optionSelectionSingle") },
                { value: "multiple", label: t("optionSelectionMultiple") },
              ]}
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name={`optionGroups.${index}.required`}
        render={({ field }) => (
          <DashboardSwitchField
            label={t("optionRequiredLabel")}
            hint={t("optionRequiredHint")}
            ariaLabel={t("optionRequiredAria", { number })}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      {selection === "multiple" ? (
        <div className="grid grid-cols-2 gap-4">
          {required ? (
            <DashboardFormField label={t("optionMin")} error={fieldError(groupErrors?.minChoices?.message)}>
              {(wiring) => (
                <Input
                  {...wiring}
                  {...register(`optionGroups.${index}.minChoices`)}
                  size="control-md"
                  inputClassName={FIELD_INPUT}
                  inputMode="numeric"
                  placeholder="1"
                />
              )}
            </DashboardFormField>
          ) : null}
          <DashboardFormField label={t("optionMax")} error={fieldError(groupErrors?.maxChoices?.message)}>
            {(wiring) => (
              <Input
                {...wiring}
                {...register(`optionGroups.${index}.maxChoices`)}
                size="control-md"
                inputClassName={FIELD_INPUT}
                inputMode="numeric"
                placeholder={t("optionMaxPlaceholder")}
              />
            )}
          </DashboardFormField>
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {fields.map((field, choiceIndex) => (
          <ProductOptionChoiceFields
            key={field.id}
            control={control}
            register={register}
            getValues={getValues}
            setValue={setValue}
            groupIndex={index}
            index={choiceIndex}
            count={fields.length}
            showDefault={selection === "single" && required === true}
            onMove={(to) => move(choiceIndex, to)}
            onRemove={() => remove(choiceIndex)}
          />
        ))}
      </ol>
      {choicesError ? <FormMessage className={FIELD_ERROR}>{choicesError}</FormMessage> : null}

      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="w-full px-3 sm:w-fit"
        disabled={fields.length >= MAX_OPTION_CHOICES}
        onClick={() => append({ ...NEW_CHOICE })}
      >
        <Icon icon={Plus} size="icon-md" className="me-2" />
        {t("addOptionChoice")}
      </Button>
    </fieldset>
  );
}
