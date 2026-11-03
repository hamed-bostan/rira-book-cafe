import { useTranslations } from "next-intl";

import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

/** Marks a line of a second round — added after the order came in — so the bar sees it's new. */
export function KitchenAddedTag() {
  const t = useTranslations("dashKitchen");

  return (
    <Badge variant="info" appearance="outline" size="compact" className="mt-1 w-fit">
      {t("added")}
    </Badge>
  );
}
