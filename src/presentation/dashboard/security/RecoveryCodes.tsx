"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

type RecoveryCodesProps = {
  codes: string[];
  /** "I've saved them" — the codes won't be shown again after this. */
  onDone: () => void;
  doneLabel: string;
};

/**
 * The recovery codes, shown once, right after two-factor is turned on. Only their
 * hashes are kept, so there is no "show them again": the copy button and the
 * warning are the whole design.
 */
export function RecoveryCodes({ codes, onDone, doneLabel }: RecoveryCodesProps) {
  const t = useTranslations("dashSecurity");
  const { toast } = useToast();

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast({ tone: "success", title: t("twoFactor.codesCopied") });
    } catch {
      toast({ tone: "error", title: t("twoFactor.codesCopyFailed") });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-body-strong text-foreground">{t("twoFactor.codesHeading")}</h3>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {t("twoFactor.codesMessage")}
        </p>
      </div>
      <ol
        aria-label={t("twoFactor.codesHeading")}
        dir="ltr"
        className="grid grid-cols-1 gap-2 rounded-button border border-border bg-surface p-4 font-mono text-body-default tracking-wider sm:grid-cols-2 sm:text-body-small"
      >
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="control-md" variant="secondary" className="px-3" onClick={() => void copy()}>
          <Icon icon={Copy} size="sm" />
          {t("twoFactor.copyCodes")}
        </Button>
        <Button type="button" size="control-md" className="px-4" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}
