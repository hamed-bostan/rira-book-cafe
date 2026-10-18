"use client";

import { useTranslations } from "next-intl";

import { RouteErrorState, type RouteErrorProps } from "@/src/presentation/components/RouteErrorState";

export default function AccountError(props: RouteErrorProps) {
  const t = useTranslations("siteErrors");

  return <RouteErrorState {...props} title={t("account")} homeHref="/" />;
}
