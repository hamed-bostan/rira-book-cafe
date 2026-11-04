"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { RoleEditorDialog } from "./RoleEditorDialog";
import { rolesApi } from "./team-api";

import type { RoleWire } from "./security-response-schema";

type RoleActionsProps = {
  role: RoleWire;
  /** The role's name as the row shows it. */
  label: string;
};

/**
 * A role's buttons: Edit, and — for a custom role nobody holds — Delete. A role
 * someone still holds says why it can't go rather than offering a Delete the
 * server would refuse.
 */
export function RoleActions({ role, label }: RoleActionsProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = React.useState<"edit" | "delete" | null>(null);
  const [opened, setOpened] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function open(next: "edit" | "delete"): void {
    setOpened((count) => count + 1);
    setError(null);
    setDialog(next);
  }

  function remove(): void {
    setError(null);
    startTransition(async () => {
      try {
        await rolesApi.remove(role.key);
        toast({ tone: "success", title: t("roles.deleted", { name: label }) });
        setDialog(null);
      } catch (err) {
        setError(
          err instanceof ApiError && err.code === "ROLE_IN_USE"
            ? t("roles.inUse")
            : localizeApiError(err, tApiErrors, t("roles.deleteError")),
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button size="control-sm" variant="secondary" className="px-3" onClick={() => open("edit")}>
        {t("roles.edit")}
      </Button>
      {!role.builtIn ? (
        <Button
          size="control-sm"
          variant="secondary"
          className="px-3"
          onClick={() => open("delete")}
          disabled={role.memberCount > 0}
          title={role.memberCount > 0 ? t("roles.inUse") : undefined}
        >
          {t("roles.delete")}
        </Button>
      ) : null}

      <RoleEditorDialog
        key={`edit-${opened}`}
        open={dialog === "edit"}
        onOpenChange={(next) => !next && setDialog(null)}
        editing={role}
        roleLabel={label}
      />
      <DashboardDialog
        open={dialog === "delete"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={t("roles.deleteTitle", { name: label })}
        subtitle={t("roles.deleteMessage")}
        submitLabel={t("roles.delete")}
        danger
        pending={pending}
        onSubmit={remove}
        error={error}
      />
    </div>
  );
}
