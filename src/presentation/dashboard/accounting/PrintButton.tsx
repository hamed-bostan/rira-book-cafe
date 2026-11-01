"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** Opens the browser's print dialog on the page; the shell and the controls drop away on paper. */
export function PrintButton() {
  const t = useTranslations("dashAccounting.export");

  return (
    <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => window.print()}>
      <Icon icon={Printer} size="icon-md" className="me-2" />
      {t("print")}
    </Button>
  );
}
