import { ArrowLeft } from "lucide-react";

import { Link } from "@/src/i18n/navigation";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

type DashboardBackLinkProps = {
  href: string;
  children: string;
};

/** The way back to a list from one of its full pages; the padding only widens a phone's tap target. */
export function DashboardBackLink({ href, children }: DashboardBackLinkProps) {
  return (
    <Link
      href={href}
      className="-my-3 inline-flex w-fit items-center gap-1.5 py-3 text-body-default font-medium text-muted-foreground transition-colors hover:text-foreground sm:my-0 sm:py-0 sm:text-body-small"
    >
      <Icon icon={ArrowLeft} size="icon-md" className="rtl:-scale-x-100" />
      {children}
    </Link>
  );
}
