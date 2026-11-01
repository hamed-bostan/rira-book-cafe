import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** Downloads what's on screen as a spreadsheet file. */
export async function ExportCsvLink({ href }: { href: string }) {
  const t = await getTranslations("dashAccounting.export");

  return (
    <Button asChild variant="secondary" size="control-md" className="px-3">
      <a href={href} download>
        <Icon icon={Download} size="icon-md" className="me-2" />
        {t("csv")}
      </a>
    </Button>
  );
}
