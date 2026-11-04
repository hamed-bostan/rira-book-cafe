"use client";

import { useTranslations } from "next-intl";

import type { SecondFactorInput } from "@/src/contracts/team-security-schema";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

export type SecondFactorDraft = { mode: "code" | "recovery"; value: string };

/** The draft as the endpoints take it. */
export function secondFactorInput(draft: SecondFactorDraft): SecondFactorInput {
  return draft.mode === "code" ? { code: draft.value } : { recoveryCode: draft.value };
}

type SecondFactorFieldsProps = {
  draft: SecondFactorDraft;
  onChange: (draft: SecondFactorDraft) => void;
  /** Whether a recovery code is offered as the way in (not when confirming a new app). */
  allowRecovery?: boolean;
  /** What's wrong with the code, under the field. */
  error?: string | null;
};

/**
 * The six digits from the authenticator app — or, behind a link, one of the
 * recovery codes for someone without their phone. One field either way, so the
 * form around it stays the same.
 */
export function SecondFactorFields({ draft, onChange, allowRecovery = true, error }: SecondFactorFieldsProps) {
  const t = useTranslations("dashSecurity");
  const recovery = draft.mode === "recovery";

  return (
    <div className="flex flex-col gap-2">
      <DashboardField
        label={recovery ? t("twoFactor.recoveryLabel") : t("twoFactor.codeLabel")}
        hint={recovery ? t("twoFactor.recoveryHint") : t("twoFactor.codeHint")}
      >
        <Input
          size="control-md"
          dir="ltr"
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          autoCapitalize={recovery ? "characters" : "off"}
          spellCheck={false}
          maxLength={recovery ? 40 : 12}
          placeholder={recovery ? "XXXX-XXXX-XXXX-XXXX" : "123456"}
          value={draft.value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange({ ...draft, value: event.target.value })}
          className="font-mono tracking-widest"
        />
      </DashboardField>
      {error ? <p className="text-body-small font-medium text-error-foreground sm:text-body-caption">{error}</p> : null}
      {allowRecovery ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start"
          onClick={() => onChange({ mode: recovery ? "code" : "recovery", value: "" })}
        >
          {recovery ? t("twoFactor.useApp") : t("twoFactor.useRecovery")}
        </Button>
      ) : null}
    </div>
  );
}
