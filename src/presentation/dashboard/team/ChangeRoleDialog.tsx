"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { GRANTABLE_ROLES, type GrantableRole } from "@/src/domain/entities/User";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamApi } from "./team-api";
import { TeamMemberDialog } from "./TeamMemberDialog";

/** Why the server refused a role change, keyed by the code it answered with. */
const BLOCKED_REASON = {
  REVOKE_SELF: "self",
  REVOKE_OWNER: "owner",
  REVOKE_BREAK_GLASS: "breakGlass",
} as const;

type BlockedReason = (typeof BLOCKED_REASON)[keyof typeof BLOCKED_REASON];

function blockedReason(err: unknown): BlockedReason | undefined {
  if (!(err instanceof ApiError) || !err.code || !(err.code in BLOCKED_REASON)) return undefined;
  return BLOCKED_REASON[err.code as keyof typeof BLOCKED_REASON];
}

type ChangeRoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  /** The member's name as the row shows it. */
  name: string;
  /** The role they hold now — preselected, and saving it again does nothing. */
  role: GrantableRole;
};

/**
 * Moves a member to another job. The role they hold now is preselected, so Save
 * waits until a different one is picked. A refusal (it's you, they became the
 * owner meanwhile, their access is in the server config) reads in the dialog in
 * this page's words rather than the remove-access wording the codes share.
 */
export function ChangeRoleDialog({ open, onOpenChange, id, name, role }: ChangeRoleDialogProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [next, setNext] = React.useState<GrantableRole>(role);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await teamApi.changeRole(id, { role: next });
        toast({ tone: "success", title: t("changeRole.done", { name, role: t(`role.${next}`) }) });
        onOpenChange(false);
      } catch (err) {
        const reason = blockedReason(err);
        setError(reason ? t(`changeRole.blocked.${reason}`) : localizeApiError(err, tApiErrors, t("changeRole.error")));
      }
      // The server stays the source of truth: the row shows the new role, or —
      // after a refusal — whatever changed underneath it.
      router.refresh();
    });
  }

  return (
    <TeamMemberDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("changeRole.title", { name })}
      message={t("changeRole.message")}
      submitLabel={t("changeRole.confirm")}
      blocked={next === role}
      pending={pending}
      onSubmit={submit}
      error={error}
    >
      <label className="flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("roleLabel")}
        <Select
          size="control-md"
          value={next}
          onChange={(event) => setNext(GRANTABLE_ROLES.find((option) => option === event.target.value) ?? role)}
        >
          {GRANTABLE_ROLES.map((option) => (
            <option key={option} value={option}>
              {t(`roleOption.${option}`)}
            </option>
          ))}
        </Select>
        <span className="text-body-small font-normal text-muted-foreground sm:text-body-caption">{t("roleHint")}</span>
      </label>
    </TeamMemberDialog>
  );
}
