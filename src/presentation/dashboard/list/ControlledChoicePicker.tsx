"use client";

import { cn } from "@/src/lib/utils";
import { PopoverClose } from "@/src/presentation/design-system/components/Popover/Popover";

import { ListFilterPopover, type ListFilterSize } from "./ListFilterPopover";
import { LIST_OPTIONS, ListRadioOption } from "./ListOption";

import type { ListFilterOption } from "./ListFilterSelect";

type ControlledChoicePickerProps = {
  label: string;
  value: string;
  options: ListFilterOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  inactiveValue?: string;
  isActive?: boolean;
  disabled?: boolean;
  id?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  triggerClassName?: string;
  /**
   * A short name shown on the trigger before the chosen value ("Sort · Newest
   * first"). Without it the trigger shows the value alone.
   */
  triggerLabel?: string;
  /**
   * `md` (the 40px trigger of the forms not redesigned yet) by default; a
   * redesigned toolbar passes `control-md`.
   */
  size?: ListFilterSize;
};

/** A styled single-choice picker for client-side table filters. */
export function ControlledChoicePicker({
  label,
  value,
  options,
  onValueChange,
  placeholder,
  inactiveValue = "all",
  isActive,
  disabled = false,
  id,
  ariaDescribedBy,
  ariaInvalid,
  triggerClassName,
  triggerLabel,
  size = "md",
}: ControlledChoicePickerProps) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder ?? options[0]?.label ?? label;

  return (
    <ListFilterPopover
      label={triggerLabel ?? selectedLabel}
      value={triggerLabel ? selectedLabel : undefined}
      isActive={isActive ?? value !== inactiveValue}
      disabled={disabled}
      triggerId={id}
      triggerAriaDescribedBy={ariaDescribedBy}
      triggerAriaInvalid={ariaInvalid}
      contentClassName="w-[var(--radix-popover-trigger-width)] min-w-48"
      triggerClassName={triggerClassName}
      size={size}
    >
      <div role="radiogroup" aria-label={label} className={size === "md" ? "flex flex-col gap-1 p-1" : LIST_OPTIONS}>
        {options.map((option) => {
          const isSelected = option.value === value;
          if (size !== "md") {
            return (
              <PopoverClose asChild key={option.value}>
                <ListRadioOption
                  name={`controlled-choice-${label}`}
                  value={option.value}
                  label={option.label}
                  selected={isSelected}
                  onSelect={() => onValueChange(option.value)}
                />
              </PopoverClose>
            );
          }
          return (
            <PopoverClose asChild key={option.value}>
              <label
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-button px-2 py-2 text-start text-body-bold transition-colors",
                  isSelected ? "bg-accent font-medium text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={`controlled-choice-${label}`}
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onValueChange(option.value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                    isSelected ? "border-primary" : "border-border",
                  )}
                >
                  {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span dir="auto" className="min-w-0 truncate">
                  {option.label}
                </span>
              </label>
            </PopoverClose>
          );
        })}
      </div>
    </ListFilterPopover>
  );
}
