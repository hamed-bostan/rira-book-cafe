"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamApi } from "./team-api";

type ResetTwoFactorButtonProps = {
  id: string;
  /** The member's name as the page shows it. */
  name: string;
};

/**
 * The owner clears a member's authenticator app — a lost or replaced phone — and
 * signs them out everywhere. They set the app up again at their next sign-in (at
 * once, if the owner requires two-factor). Recorded in the activity log.
 */
export function ResetTwoFactorButton({ id, name }: ResetTwoFactorButtonProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await teamApi.resetTwoFactor(id);
        toast({ tone: "success", title: t("security.resetDone", { name }) });
        setOpen(false);
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("security.resetError")));
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="control-md"
        variant="secondary"
        className="self-start px-3"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("security.reset")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("security.resetTitle", { name })}
        subtitle={t("security.resetMessage")}
        submitLabel={t("security.reset")}
        danger
        pending={pending}
        onSubmit={submit}
        error={error}
      />
    </>
  );
}
