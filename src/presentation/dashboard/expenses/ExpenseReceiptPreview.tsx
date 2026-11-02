import { FileText } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { isPdfReceipt } from "@/src/domain/entities/Expense";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { ROW_CAPTION } from "../pageStyles";

/**
 * A receipt, opening in a new tab: a photo or scan shown whole rather than cropped,
 * or a PDF as a file to open. Never optimized: `/uploads` only serves it to
 * `accounting.view`, and `/_next/image` would keep a copy in a cache that doesn't
 * check who's asking.
 */
export function ExpenseReceiptPreview({ src }: { src: string }) {
  const t = useTranslations("dashExpenses.receipt");

  if (isPdfReceipt(src)) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-button border border-border bg-muted px-4 py-3 transition-colors hover:border-primary"
      >
        <Icon icon={FileText} size="icon-lg" className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground">{t("pdf")}</span>
          <span className={ROW_CAPTION}>{t("openPdf")}</span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      aria-label={t("open")}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-button border border-border bg-muted"
    >
      <Image src={src} alt={t("alt")} fill unoptimized className="object-contain" />
    </a>
  );
}
