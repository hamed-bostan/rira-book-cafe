"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

interface PageHeaderProps {
  /** Centred title. Omit for a back-only header. */
  title?: string;
  /**
   * Where the back control goes. Pass the screen's logical parent to walk a
   * predictable hierarchy (e.g. Edit Address → Manage Address → Profile) instead of
   * retracing raw browser history — the multi-step add flow (picker → details →
   * push back to the list) pollutes that history, so `router.back()` loops through
   * pages the user didn't expect. Omit to keep the default history pop.
   */
  backHref?: string;
  className?: string;
  /** Page headings can expand while compact task headers stay at H3. */
  responsiveTitle?: boolean;
  titleClassName?: string;
}

/** Sub-page header: a back control on the left with an optional centred title. */
export function PageHeader({ title, backHref, className, responsiveTitle = false, titleClassName }: PageHeaderProps) {
  const t = useTranslations("common");
  const router = useRouter();

  const backIcon = <Icon icon={ChevronLeft} size="md" className="text-foreground rtl:-scale-x-100" />;

  return (
    <header className={cn("grid grid-cols-[1fr_auto_1fr] items-center pt-3", className)}>
      {backHref ? (
        // Hierarchical "Up": a real link to the logical parent — it prefetches and
        // behaves like navigation (new-tab, etc.), unlike an onClick history push.
        <Button asChild variant="ghost" iconOnly aria-label={t("goBack")} className="justify-self-start">
          <Link href={backHref}>{backIcon}</Link>
        </Button>
      ) : (
        // No fixed parent given: fall back to a chronological history pop.
        <Button
          type="button"
          variant="ghost"
          iconOnly
          aria-label={t("goBack")}
          onClick={() => router.back()}
          className="justify-self-start"
        >
          {backIcon}
        </Button>
      )}
      {title ? (
        <h1
          className={cn(
            "min-w-0 text-center text-heading-subsection break-words text-foreground",
            responsiveTitle && "sm:text-heading-page",
            titleClassName,
          )}
        >
          {title}
        </h1>
      ) : null}
    </header>
  );
}
