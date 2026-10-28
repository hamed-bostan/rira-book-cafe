import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** A filter panel's list of options, as the redesign draws it: inset 4px, rows touching. */
export const LIST_OPTIONS = "flex flex-col p-1";

/**
 * One option in a filter panel: a 36px row (44px to the touch on a phone), the
 * label at body size, and the one in effect in semibold with a tick at the end —
 * the weight says which, without a tint competing with the hover.
 */
export function listOptionClass(selected: boolean): string {
  return cn(
    "flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-button px-3 text-start text-body-default whitespace-nowrap text-foreground transition-colors hover:bg-muted sm:h-9 sm:text-body-small",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring",
    selected ? "font-semibold" : "font-normal",
  );
}

/** The tick at the end of the option in effect; nothing on the others. */
export function ListOptionCheck({ selected }: { selected: boolean }) {
  return selected ? <Icon icon={Check} size="icon-md" strokeWidth={2} className="text-primary" /> : null;
}

type ListRadioOptionProps = Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "onSelect"> & {
  /** The radio group's name. */
  name: string;
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
};

/**
 * An option backed by a real radio input (kept for the keyboard and screen
 * readers, visually hidden), drawn as a {@link listOptionClass} row. Forwards its
 * ref and props so a `PopoverClose asChild` can close the panel on the pick.
 */
export const ListRadioOption = React.forwardRef<HTMLLabelElement, ListRadioOptionProps>(
  ({ name, value, label, selected, onSelect, className, ...props }, ref) => (
    <label ref={ref} className={cn(listOptionClass(selected), className)} {...props}>
      <input type="radio" name={name} value={value} checked={selected} onChange={onSelect} className="sr-only" />
      <span dir="auto" className="min-w-0 flex-1 truncate">
        {label}
      </span>
      <ListOptionCheck selected={selected} />
    </label>
  ),
);

ListRadioOption.displayName = "ListRadioOption";
