"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { PageHeader } from "@/src/presentation/components/PageHeader";
import { Button, OTPInput } from "@/src/presentation/design-system";

import { peekDevOtp, requestOtp, verifyOtp } from "./actions";

const CODE_LENGTH = 4;
const RESEND_SECONDS = 27;

interface OtpScreenProps {
  phone: string;
  callbackUrl?: string;
}

export default function OtpScreen({ phone, callbackUrl = "/" }: OtpScreenProps) {
  const t = useTranslations("auth");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_SECONDS);
  const [devCode, setDevCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // Dev only: pull the mock code (generated when it was "sent") to show on screen.
  React.useEffect(() => {
    let active = true;
    peekDevOtp(phone)
      .then((c) => active && setDevCode(c))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [phone]);

  const isComplete = code.length === CODE_LENGTH;

  const handleCodeChange = (next: string) => {
    setCode(next);
    if (error) setError(false);
  };

  const handleVerify = async () => {
    if (!isComplete) return;
    setPending(true);

    // Success redirects away; only a wrong code returns here.
    const result = await verifyOtp({ phone, code, callbackUrl });
    if (result?.error) {
      setError(true);
      setPending(false);
    }
  };

  const handleResend = async () => {
    await requestOtp(phone);
    setCode("");
    setError(false);
    setSecondsLeft(RESEND_SECONDS);
    setDevCode(await peekDevOtp(phone));
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const subtitle = error
    ? t("incorrectCode")
    : code.length === 0
      ? t("enterCode", { phone: maskPhone(phone) })
      : t("waitingCode");

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10">
      <PageHeader title={t("verifyTitle")} />

      <p className={cn("mt-2 text-center text-body-bold", error ? "text-destructive" : "text-muted-foreground")}>
        {subtitle}
      </p>

      <div className="mt-20 flex flex-col items-center gap-5">
        <OTPInput
          value={code}
          onChange={handleCodeChange}
          length={CODE_LENGTH}
          autoFocus
          aria-label={t("codeAria")}
          aria-invalid={error || undefined}
        />

        {devCode && (
          <button
            type="button"
            onClick={() => handleCodeChange(devCode)}
            className="rounded-card-lg border border-dashed border-border bg-muted px-3 py-1.5 text-body-small-emphasis text-muted-foreground"
          >
            {t("devCodeLabel")} <span className="font-semibold text-foreground">{devCode}</span> {t("devCodeTapToFill")}
          </button>
        )}

        <p className="text-body-small text-muted-foreground">
          {secondsLeft > 0 ? (
            t("resendIn", { time: `${mm}:${ss}` })
          ) : (
            <Button type="button" variant="link" onClick={handleResend} >
              {t("resendCode")}
            </Button>
          )}
        </p>
      </div>

      <Button
        type="button"
        onClick={handleVerify}
        variant={isComplete ? "primary" : "outline"}
        disabled={!isComplete || pending}
        size="lg"
        className="mt-4"
      >
        {pending ? t("verifying") : t("verifyCode")}
      </Button>

      <Button asChild variant="ghost" className="mt-8 self-center text-body-small-emphasis">
        <Link href="/login">{t("changePhone")}</Link>
      </Button>
    </div>
  );
}

/** Masks the phone for display, e.g. "+1 •••• 7890". */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${phone.trim().slice(0, 2)} •••• ${digits.slice(-4)}`;
}
