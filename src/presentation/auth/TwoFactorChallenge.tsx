"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import {
  SecondFactorFields,
  secondFactorInput,
  type SecondFactorDraft,
} from "@/src/presentation/dashboard/security/SecondFactorFields";
import { securityApi } from "@/src/presentation/dashboard/security/security-api";
import { TwoFactorSetup } from "@/src/presentation/dashboard/security/TwoFactorSetup";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { signInAgain } from "./actions";

type TwoFactorChallengeProps = {
  /** What this browser owes: a code, or setting the app up (the owner requires it). */
  mode: "verify" | "enroll";
  /** Whether the server can check app codes (it has its encryption key). */
  available: boolean;
  /** Where to go once through — a dashboard path. */
  callbackUrl: string;
};

/**
 * The dashboard's second door, after the phone code: the authenticator app's code
 * (or a recovery code), or — when the owner requires two-factor and this person
 * hasn't set it up — setting it up now. Either way it ends with a full navigation
 * to where they were going, so the new session state is read fresh.
 */
export function TwoFactorChallenge({ mode, available, callbackUrl }: TwoFactorChallengeProps) {
  const t = useTranslations("dashSecurity");
  const tApiErrors = useTranslations("apiErrors");
  const [draft, setDraft] = React.useState<SecondFactorDraft>({ mode: available ? "code" : "recovery", value: "" });
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function proceed(): void {
    window.location.assign(callbackUrl);
  }

  function verify(): void {
    setError(null);
    setCodeError(null);
    startTransition(async () => {
      try {
        await securityApi.verifyTwoFactor(secondFactorInput(draft));
        proceed();
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) setCodeError(t("twoFactor.wrongCode"));
        else setError(localizeApiError(err, tApiErrors, t("challenge.error")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-card-lg border border-border bg-background p-5 shadow-xs">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-subsection text-foreground">
          {mode === "verify" ? t("challenge.verifyTitle") : t("challenge.enrollTitle")}
        </h1>
        <p className="text-body-default text-pretty text-muted-foreground">
          {mode === "verify"
            ? available
              ? t("challenge.verifyMessage")
              : t("challenge.verifyRecoveryOnly")
            : t("challenge.enrollMessage")}
        </p>
      </div>

      {mode === "verify" ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) verify();
          }}
        >
          <SecondFactorFields draft={draft} onChange={setDraft} allowRecovery={available} error={codeError} />
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending || !draft.value.trim()}
            aria-busy={pending}
          >
            {t("challenge.continue")}
          </Button>
        </form>
      ) : (
        <TwoFactorSetup onDone={proceed} doneLabel={t("challenge.continueToDashboard")} />
      )}

      <form action={() => signInAgain(callbackUrl)} className="border-t border-border pt-4">
        <Button type="submit" variant="link" size="sm">
          {t("challenge.signOut")}
        </Button>
      </form>
    </div>
  );
}
