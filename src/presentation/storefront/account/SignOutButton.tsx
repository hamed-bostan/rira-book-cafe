"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { logout } from "@/src/presentation/auth/actions";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** Signs the guest out and returns them to the home page. The basket stays in this browser. */
export function SignOutButton() {
  const t = useTranslations("site");
  const [pending, startTransition] = React.useTransition();

  return (
    <Button type="button" variant="outline" loading={pending} onClick={() => startTransition(() => logout())}>
      {/* The spinner takes the icon's place while signing out. */}
      {pending ? null : <Icon icon={LogOut} size="sm" className="me-1.5" />}
      {t("account.signOut")}
    </Button>
  );
}
