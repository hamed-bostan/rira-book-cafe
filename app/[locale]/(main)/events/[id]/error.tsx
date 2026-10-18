"use client";

import { useTranslations } from "next-intl";

import { RouteErrorState, type RouteErrorProps } from "@/src/presentation/components/RouteErrorState";

export default function EventError(props: RouteErrorProps) {
  const t = useTranslations("siteErrors");

  return <RouteErrorState {...props} title={t("event")} homeHref="/" />;
}
