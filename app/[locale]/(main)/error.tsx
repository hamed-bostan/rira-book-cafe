"use client";

import { useTranslations } from "next-intl";

import { RouteErrorState, type RouteErrorProps } from "@/src/presentation/components/RouteErrorState";

/**
 * Storefront fallback boundary: the home page, and any public segment without a
 * boundary of its own. Renders inside the public layout, so the header and the
 * bottom bar stay usable while the page body offers a retry.
 */
export default function StorefrontError(props: RouteErrorProps) {
  const t = useTranslations("siteErrors");

  return <RouteErrorState {...props} title={t("home")} />;
}
