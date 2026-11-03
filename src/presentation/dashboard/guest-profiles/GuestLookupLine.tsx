"use client";

import { CircleAlert, UserCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Spinner } from "@/src/presentation/design-system/components/Spinner/Spinner";

import type { GuestLookup } from "./useGuestLookup";

type GuestLookupLineProps = {
  /** `null` while the number can't be anyone's yet. */
  lookup: GuestLookup | null;
};

/** The line under a guest's phone: what looking it up found, with an icon that says it at a glance. */
export function GuestLookupLine({ lookup }: GuestLookupLineProps) {
  const t = useTranslations("dashGuestProfiles");
  switch (lookup?.state) {
    case undefined:
      return <>{t("phoneHint")}</>;
    case "checking":
      return (
        <>
          <Spinner size="xs" decorative />
          {t("checking")}
        </>
      );
    case "found":
      return (
        <>
          <Icon icon={UserCheck} size="sm" className="shrink-0 text-success-foreground" />
          <span className="min-w-0 break-words">
            {lookup.match.name === null
              ? t("foundNoName")
              : lookup.match.signedIn
                ? t("found", { name: lookup.match.name })
                : t("foundNotSignedIn", { name: lookup.match.name })}
          </span>
        </>
      );
    case "new":
      return (
        <>
          <Icon icon={UserPlus} size="sm" className="shrink-0 text-primary" />
          {t("newGuest")}
        </>
      );
    case "failed":
      return (
        <>
          <Icon icon={CircleAlert} size="sm" className="shrink-0 text-error-foreground" />
          {t("failed")}
        </>
      );
  }
}
