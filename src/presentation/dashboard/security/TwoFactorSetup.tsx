"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import type { TwoFactorSetupWire } from "@/src/presentation/dashboard/team/security-response-schema";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { RecoveryCodes } from "./RecoveryCodes";
import { SecondFactorFields, type SecondFactorDraft } from "./SecondFactorFields";
import { securityApi } from "./security-api";

type TwoFactorSetupProps = {
  /** After the recovery codes are acknowledged: refresh, or go on to the dashboard. */
  onDone: () => void;
  /** The last button's label ("Done", "Continue to the dashboard"). */
  doneLabel: string;
};

type Step = { kind: "start" } | { kind: "scan"; setup: TwoFactorSetupWire } | { kind: "codes"; codes: string[] };

/** The secret in groups of four, as people type it from a screen. */
function groupedKey(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

/**
 * Setting up an authenticator app: scan the QR code (or type the key), confirm with
 * the first code it shows, then save the recovery codes. Nothing is switched on
 * until the code checks out, so a scan that didn't take can't lock anyone out.
 */
export function TwoFactorSetup({ onDone, doneLabel }: TwoFactorSetupProps) {
  const t = useTranslations("dashSecurity");
  const tApiErrors = useTranslations("apiErrors");
  const [step, setStep] = React.useState<Step>({ kind: "start" });
  const [draft, setDraft] = React.useState<SecondFactorDraft>({ mode: "code", value: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function start(): void {
    setError(null);
    startTransition(async () => {
      try {
        setStep({ kind: "scan", setup: await securityApi.startTwoFactorSetup() });
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("twoFactor.setupError")));
      }
    });
  }

  function confirm(): void {
    setError(null);
    setCodeError(null);
    startTransition(async () => {
      try {
        setStep({ kind: "codes", codes: await securityApi.enableTwoFactor({ code: draft.value }) });
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) setCodeError(t("twoFactor.wrongCode"));
        else setError(localizeApiError(err, tApiErrors, t("twoFactor.setupError")));
      }
    });
  }

  if (step.kind === "codes") return <RecoveryCodes codes={step.codes} onDone={onDone} doneLabel={doneLabel} />;

  if (step.kind === "start") {
    return (
      <div className="flex flex-col gap-3">
        {error ? <FormAlert>{error}</FormAlert> : null}
        <Button size="control-md" className="self-start px-4" onClick={start} disabled={pending} aria-busy={pending}>
          {t("twoFactor.setUp")}
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) confirm();
      }}
    >
      <ol className="flex list-decimal flex-col gap-2 ps-5 text-body-default text-pretty text-foreground sm:text-body-small">
        <li>{t("twoFactor.stepInstall")}</li>
        <li>{t("twoFactor.stepScan")}</li>
        <li>{t("twoFactor.stepConfirm")}</li>
      </ol>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* A data: URL made on the server — the secret never touches a third party. The
            image carries its own white quiet zone, so it scans on a dark theme too. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={step.setup.qrCode}
          alt={t("twoFactor.qrAlt")}
          width={176}
          height={176}
          className="size-44 rounded-button border border-border"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-body-default font-medium text-foreground sm:text-body-small">
            {t("twoFactor.manualKey")}
          </span>
          <code
            dir="ltr"
            className="rounded-button bg-muted px-2 py-1 font-mono text-body-default tracking-wider break-all select-all sm:text-body-small"
          >
            {groupedKey(step.setup.secret)}
          </code>
        </div>
      </div>
      <SecondFactorFields draft={draft} onChange={setDraft} allowRecovery={false} error={codeError} />
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="submit"
          size="control-md"
          className="px-4"
          disabled={pending || !draft.value.trim()}
          aria-busy={pending}
        >
          {t("twoFactor.confirm")}
        </Button>
      </div>
    </form>
  );
}
