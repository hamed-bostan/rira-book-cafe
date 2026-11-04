"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useFieldArray,
  useFormState,
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import type { ProductFormInput } from "@/src/contracts/product-schema";
import { MAX_OPTION_GROUPS } from "@/src/domain/entities/ProductOptions";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { FIELD_ERROR, FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { ProductOptionGroupFields } from "./ProductOptionGroupFields";

type ProductOptionGroupsEditorProps = {
  control: Control<ProductFormInput>;
  register: UseFormRegister<ProductFormInput>;
  getValues: UseFormGetValues<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
};

/** A new group starts as the commonest kind: a required size, two blank choices. */
export const NEW_OPTION_GROUP: NonNullable<ProductFormInput["optionGroups"]>[number] = {
  name: "",
  nameFa: "",
  required: true,
  selection: "single",
  minChoices: "",
  maxChoices: "",
  choices: [
    { name: "", nameFa: "", priceDelta: "", isAvailable: true, isDefault: true },
    { name: "", nameFa: "", priceDelta: "", isAvailable: true, isDefault: false },
  ],
};

/**
 * The product form's Options: the item's option groups, in order — add one, move
 * it, take it off — each with its choices. Validated by the shared
 * `productFormSchema` here and again by the API, which saves them with the item.
 */
export function ProductOptionGroupsEditor({ control, register, getValues, setValue }: ProductOptionGroupsEditorProps) {
  const t = useTranslations("dashProducts");
  const tFormErrors = useTranslations("formErrors");
  const { fields, append, remove, move } = useFieldArray({ control, name: "optionGroups" });
  const { errors } = useFormState({ control, name: "optionGroups" });
  // A message for the list as a whole: the client's ("at most 8") or the API's.
  const listError = formErrorMessage(tFormErrors, errors.optionGroups?.message ?? errors.optionGroups?.root?.message);

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 ? <p className={FIELD_HINT}>{t("optionsNone")}</p> : null}
      {fields.map((field, index) => (
        <ProductOptionGroupFields
          key={field.id}
          control={control}
          register={register}
          getValues={getValues}
          setValue={setValue}
          index={index}
          count={fields.length}
          onMove={(to) => move(index, to)}
          onRemove={() => remove(index)}
        />
      ))}
      {listError ? <FormMessage className={FIELD_ERROR}>{listError}</FormMessage> : null}
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="w-full px-3 sm:w-fit"
        disabled={fields.length >= MAX_OPTION_GROUPS}
        onClick={() => append(structuredClone(NEW_OPTION_GROUP))}
      >
        <Icon icon={Plus} size="icon-md" className="me-2" />
        {t("addOptionGroup")}
      </Button>
    </div>
  );
}
