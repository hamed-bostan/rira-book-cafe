"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { signInAgain } from "./actions";

type SignInAgainNoticeProps = {
  callbackUrl: string;
};

/**
 * For a browser signed in before sessions were recorded: it can't be signed out
 * from elsewhere, so it doesn't open the dashboard. Signing in again gives it a
 * session that can — once, and the storefront never asked.
 */
export function SignInAgainNotice({ callbackUrl }: SignInAgainNoticeProps) {
  const t = useTranslations("dashSecurity");
  return (
    <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-subsection text-foreground">{t("challenge.signInAgainTitle")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground">{t("challenge.signInAgainMessage")}</p>
      </div>
      <form action={() => signInAgain(callbackUrl)}>
        <Button type="submit" size="lg" className="w-full">
          {t("challenge.signInAgain")}
        </Button>
      </form>
    </div>
  );
}
