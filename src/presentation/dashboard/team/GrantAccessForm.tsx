"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { flattenError } from "zod";

import { grantAdminSchema } from "@/src/contracts/team-schema";
import { normalizePhone, phoneDigits, teamPhoneDigitsWhenComplete } from "@/src/domain/entities/Phone";
import { GRANTABLE_ROLES, type GrantableRole } from "@/src/domain/entities/User";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatPhone } from "@/src/lib/formatPhone";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamApi } from "./team-api";

type GrantAccessFormProps = {
  /** Who already has access, by id — their normalized phone. */
  memberIds: readonly string[];
};

/**
 * Give the holder of a phone number dashboard access. Checked as you type against
 * the same `grantAdminSchema` the route re-validates with: Grant access waits
 * until the number is whole and isn't already on the team, and one line under
 * the fields says what's wrong.
 *
 * There's no "invite sent / pending" state: the grant lands on the account behind
 * that phone at once, and only someone who passes OTP on the number can use it.
 * The email is only where the invitation is sent. A successful grant re-runs the
 * server render and the new member appears in the list.
 */
export function GrantAccessForm({ memberIds }: GrantAccessFormProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();

  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  // Least privilege by default — giving someone more than read access is a choice.
  const [role, setRole] = React.useState<GrantableRole>("support");
  // A field's problem is pointed out once you've left it, not at the first keystroke.
  const [touched, setTouched] = React.useState({ phone: false, email: false });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const parsed = grantAdminSchema.safeParse({ phone, email, role });
  const issues = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  const taken = parsed.success && memberIds.includes(normalizePhone(parsed.data.phone));
  // Once it has all the digits a number typed that way needs (11 for 0912…, 12 for
  // +98 912…), a wrong number is pointed out while typing; before that, on leaving.
  const typedInFull = phoneDigits(phone).length >= teamPhoneDigitsWhenComplete(phone);
  const phoneIssue = phone.trim() !== "" && (touched.phone || typedInFull) ? issues.phone?.[0] : undefined;
  const emailIssue = email.trim() !== "" && touched.email ? issues.email?.[0] : undefined;

  const message = phoneIssue
    ? formErrorMessage(tFormErrors, phoneIssue)
    : taken
      ? t("alreadyMember")
      : emailIssue
        ? formErrorMessage(tFormErrors, emailIssue)
        : error;

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!parsed.success || taken || pending) return;
    const values = parsed.data;
    setError(null);
    startTransition(async () => {
      try {
        await teamApi.grant(values);
        toast({ tone: "success", title: t("granted", { phone: formatPhone(values.phone) }) });
        setPhone("");
        setEmail("");
        setRole("support");
        setTouched({ phone: false, email: false });
        // The server stays the source of truth — re-render rather than splicing a
        // row into a local copy of the list.
        router.refresh();
      } catch (err) {
        const fieldError = err instanceof ApiError ? (err.fieldErrors?.phone ?? err.fieldErrors?.email) : undefined;
        setError(formErrorMessage(tFormErrors, fieldError) ?? localizeApiError(err, tApiErrors, t("grantError")));
      }
    });
  }

  return (
    <section
      aria-labelledby="grant-access-heading"
      className="flex min-w-0 flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h2 id="grant-access-heading" className="text-body-strong text-foreground">
          {t("grantHeading")}
        </h2>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {t("grantDescription")}
        </p>
      </div>

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]">
          <DashboardField label={t("phoneLabel")}>
            <Input
              size="control-md"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError(null);
              }}
              onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
              type="tel"
              dir="ltr"
              autoComplete="off"
              placeholder={t("phonePlaceholder")}
              aria-invalid={phoneIssue || taken ? true : undefined}
            />
          </DashboardField>
          <DashboardField label={t("emailLabel")} hint={t("emailHint")}>
            <Input
              size="control-md"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              type="email"
              dir="ltr"
              autoComplete="off"
              placeholder={t("emailPlaceholder")}
              aria-invalid={emailIssue ? true : undefined}
            />
          </DashboardField>
          <DashboardField label={t("roleLabel")} hint={t("roleHint")}>
            <Select
              size="control-md"
              value={role}
              onChange={(event) =>
                setRole(GRANTABLE_ROLES.find((option) => option === event.target.value) ?? "support")
              }
            >
              {GRANTABLE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {t(`roleOption.${option}`)}
                </option>
              ))}
            </Select>
          </DashboardField>
        </div>

        {message ? <FormAlert>{message}</FormAlert> : null}

        <Button
          type="submit"
          size="control-md"
          className="self-start px-4"
          loading={pending}
          disabled={!parsed.success || taken}
        >
          {t("grantSubmit")}
        </Button>
      </form>
    </section>
  );
}
