import { Coffee } from "lucide-react";

import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** The cafe's square mark. A placeholder icon until a real logo lands in `public/images/`. */
export function BrandMark() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Icon icon={Coffee} size="sm" />
    </span>
  );
}
