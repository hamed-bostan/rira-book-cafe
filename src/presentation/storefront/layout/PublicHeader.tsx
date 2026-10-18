"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { LocaleToggle } from "@/src/presentation/components/LocaleToggle";
import { BrandMark } from "@/src/presentation/dashboard/shell/BrandMark";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { BasketButton } from "./BasketButton";
import { PUBLIC_NAV, isPublicNavActive } from "./publicNavigation";

type PublicHeaderProps = {
  /** Whether a guest is signed in — "Sign in" or "My account". */
  signedIn: boolean;
  /** Unread notifications, for the bell's badge (0 when signed out). */
  unreadNotifications: number;
};

/**
 * The public site's header: brand, the sections (on wide screens — phones use the
 * bottom bar), language, the basket, and sign-in / account.
 */
export function PublicHeader({ signedIn, unreadNotifications }: PublicHeaderProps) {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className={cn("flex shrink-0 items-center gap-2 text-heading-subsection text-foreground", focusRing)}
        >
          <BrandMark />
          <span>{t("brand")}</span>
        </Link>

        <nav aria-label={t("navLabel")} className="hidden flex-1 items-center gap-1 md:flex">
          {PUBLIC_NAV.filter((item) => item.key !== "home" && item.key !== "account").map((item) => {
            const active = isPublicNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-body-small-emphasis transition-colors",
                  focusRing,
                  active ? "bg-accent text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <LocaleToggle />
          </div>
          {signedIn ? (
            <Link
              href="/notifications"
              aria-label={t("notifications.bellAria", { count: unreadNotifications })}
              className={cn(
                "relative grid size-10 place-items-center rounded-full text-foreground hover:bg-muted",
                focusRing,
              )}
            >
              <Icon icon={Bell} size="sm" />
              {unreadNotifications > 0 ? (
                <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-body-caption text-primary-foreground">
                  {formatNumber(Math.min(unreadNotifications, 99), locale)}
                </span>
              ) : null}
            </Link>
          ) : null}
          <BasketButton />
          <Link
            href={signedIn ? "/account" : `/login?callbackUrl=${encodeURIComponent(pathname)}`}
            className={cn(
              "hidden rounded-full border border-border px-4 py-2 text-body-small-emphasis text-foreground hover:bg-muted md:inline-flex",
              focusRing,
            )}
          >
            {signedIn ? t("nav.account") : t("signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}
