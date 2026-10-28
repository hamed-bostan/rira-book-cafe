import { CircleAlert } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import type { ReactNode } from "react";

type FormAlertProps = {
  children: ReactNode;
  className?: string;
};

/**
 * What's wrong with a form, as the redesign draws it: a warning mark and the
 * sentence in the danger colour, at body size. Announced when it appears, so a
 * screen-reader user isn't left on a form that silently refused them.
 */
export function FormAlert({ children, className }: FormAlertProps) {
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-body-default font-medium text-pretty text-error-foreground sm:text-body-small",
        className,
      )}
    >
      <Icon icon={CircleAlert} size="icon-md" className="mt-0.5" />
      {children}
    </p>
  );
}
