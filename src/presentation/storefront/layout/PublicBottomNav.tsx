"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system";

import { PUBLIC_NAV, isPublicNavActive } from "./publicNavigation";

/** Focused flows hide the bar so their own action button owns the bottom of the screen. */
const HIDE_ON = ["/basket", "/login"];

/** Thumb-reach navigation on phones; the header carries the same sections from `md` up. */
export function PublicBottomNav() {
  const t = useTranslations("site");
  const pathname = usePathname();

  if (HIDE_ON.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  return (
    <nav
      aria-label={t("navLabel")}
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.5rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {PUBLIC_NAV.map((item) => {
        const active = isPublicNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 px-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className={cn("grid size-9 place-items-center rounded-full", active ? "bg-accent" : "")}>
              <Icon icon={item.icon} size="sm" />
            </span>
            <span className="truncate text-body-caption">{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
