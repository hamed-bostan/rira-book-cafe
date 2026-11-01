import { Trash2 } from "lucide-react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

type RemoveLineButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

/** Takes a line off a form: a quiet square at the end of the row, named for screen readers and on hover. */
export function RemoveLineButton({ label, disabled, onClick }: RemoveLineButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="control-md"
      iconOnly
      className="justify-self-end border-0 bg-transparent"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon icon={Trash2} size="icon-md" />
    </Button>
  );
}
