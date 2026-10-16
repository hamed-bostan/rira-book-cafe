"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon";

import { focusRing } from "../../shared/focusRing";

type PasswordToggleProps = {
  show: boolean;
  setShow: (v: boolean) => void;
  controls?: string;
};

export function PasswordToggle({ show, setShow, controls }: PasswordToggleProps) {
  const t = useTranslations("ds");

  return (
    <button
      type="button"
      aria-label={show ? t("hidePassword") : t("showPassword")}
      aria-pressed={show}
      aria-controls={controls}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setShow(!show)}
      className={cn("flex rounded-sm", focusRing)}
    >
      <Icon icon={show ? EyeOff : Eye} size="sm" />
    </button>
  );
}
