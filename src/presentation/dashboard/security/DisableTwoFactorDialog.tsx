"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { SecondFactorFields, secondFactorInput, type SecondFactorDraft } from "./SecondFactorFields";
import { securityApi } from "./security-api";

type DisableTwoFactorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Turning your own two-factor off takes a current code (or a recovery code): the
 * same proof it asks for at sign-in, so a browser left signed in can't quietly
 * remove it.
 */
export function DisableTwoFactorDialog({ open, onOpenChange }: DisableTwoFactorDialogProps) {
  const t = useTranslations("dashSecurity");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<SecondFactorDraft>({ mode: "code", value: "" });
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    setCodeError(null);
    startTransition(async () => {
      try {
        await securityApi.disableTwoFactor(secondFactorInput(draft));
        toast({ tone: "success", title: t("twoFactor.turnedOff") });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) setCodeError(t("twoFactor.wrongCode"));
        else setError(localizeApiError(err, tApiErrors, t("twoFactor.turnOffError")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("twoFactor.turnOffTitle")}
      subtitle={t("twoFactor.turnOffMessage")}
      submitLabel={t("twoFactor.turnOff")}
      danger
      blocked={!draft.value.trim()}
      pending={pending}
      onSubmit={submit}
      error={error}
    >
      <SecondFactorFields draft={draft} onChange={setDraft} error={codeError} />
    </DashboardDialog>
  );
}
