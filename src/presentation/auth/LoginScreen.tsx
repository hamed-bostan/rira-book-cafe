"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { TextField } from "@/src/presentation/design-system/components/form/TextField/TextField";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { requestOtp } from "./actions";

export default function LoginScreen({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const result = await requestOtp(phone);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Carry the phone (and any callbackUrl) to the verification step.
    const params = new URLSearchParams({ phone });
    if (callbackUrl && callbackUrl !== "/") params.set("callbackUrl", callbackUrl);
    router.push(`/login/verify?${params.toString()}`);
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10">
      <header className="mb-16 pt-16 text-center">
        <h1 className="mb-2 text-heading-subsection text-foreground">{t("welcomeTitle")}</h1>
        <p className="text-body-strong text-muted-foreground">{t("welcomeSubtitle")}</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex min-h-28 flex-col gap-2">
          <TextField
            label={t("phoneLabel")}
            size="lg"
            type="tel"
            inputMode="tel"
            placeholder={t("phonePlaceholder")}
            autoComplete="tel"
            required
            leftElement={<Icon icon={Phone} size="sm" />}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          {error && <FormMessage>{error}</FormMessage>}
        </div>

        <Button type="submit" size="lg" loading={pending} className="mt-auto">
          {pending ? t("sendingCode") : t("continue")}
        </Button>
      </form>
    </div>
  );
}
