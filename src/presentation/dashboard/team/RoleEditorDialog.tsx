"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { flattenError } from "zod/mini";

import { ASSIGNABLE_PERMISSIONS, createRoleSchema } from "@/src/contracts/role-schema";
import { ALWAYS_GRANTED_PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/src/domain/entities/Permission";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { FIELD_HINT, FIELD_LABEL, OVERLINE } from "@/src/presentation/dashboard/fieldStyles";
import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { rolesApi } from "./team-api";

import type { RoleWire } from "./security-response-schema";

type RoleEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The role being edited, or `null` to make a new one. */
  editing: RoleWire | null;
  /** How the role reads in the title ("Staff", "Barista"). */
  roleLabel?: string;
};

const LOCKED: readonly Permission[] = ALWAYS_GRANTED_PERMISSIONS;
const ASSIGNABLE: ReadonlySet<Permission> = new Set(ASSIGNABLE_PERMISSIONS);

/**
 * Make a role, or change one: its name in both languages (a custom role only — the
 * app names its own), and what it may do, as a checklist grouped by the part of the
 * cafe each permission is about, each with a line saying what it allows.
 *
 * "Reach the dashboard" is ticked and locked: every team role has it. Team
 * management isn't on the list at all — it moves only with ownership — and the
 * dialog says so rather than leaving it to be wondered about.
 */
export function RoleEditorDialog({ open, onOpenChange, editing: role, roleLabel }: RoleEditorDialogProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const custom = !role?.builtIn;

  const [nameEn, setNameEn] = React.useState(role?.name?.en ?? "");
  const [nameFa, setNameFa] = React.useState(role?.name?.fa ?? "");
  const [chosen, setChosen] = React.useState<ReadonlySet<Permission>>(
    () => new Set([...(role?.permissions ?? []), ...LOCKED]),
  );
  const [touched, setTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const permissions = ASSIGNABLE_PERMISSIONS.filter((permission) => chosen.has(permission));
  const parsed = createRoleSchema.safeParse({
    nameEn: custom ? nameEn : "built-in",
    nameFa: custom ? nameFa : "built-in",
    permissions,
  });
  const issues = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  const nameIssue = touched ? (issues.nameEn?.[0] ?? issues.nameFa?.[0]) : undefined;

  function toggle(permission: Permission, on: boolean): void {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  function submit(): void {
    setTouched(true);
    if (!parsed.success) return;
    setError(null);
    startTransition(async () => {
      try {
        if (role === null) {
          await rolesApi.create({ nameEn, nameFa, permissions });
          toast({ tone: "success", title: t("roles.created", { name: nameEn.trim() }) });
        } else {
          await rolesApi.update(role.key, custom ? { nameEn, nameFa, permissions } : { permissions });
          toast({ tone: "success", title: t("roles.saved", { name: roleLabel ?? nameEn.trim() }) });
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError && err.code === "ROLE_NAME_TAKEN") setError(t("roles.nameTaken"));
        else setError(localizeApiError(err, tApiErrors, t("roles.saveError")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={role === null ? t("roles.newTitle") : t("roles.editTitle", { name: roleLabel ?? "" })}
      subtitle={t("roles.editMessage")}
      submitLabel={role === null ? t("roles.create") : t("roles.save")}
      pending={pending}
      onSubmit={submit}
      error={nameIssue ? formErrorMessage(tFormErrors, nameIssue) : error}
    >
      {custom ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardField label={t("roles.nameEnLabel")}>
            <Input
              size="control-md"
              dir="ltr"
              value={nameEn}
              maxLength={60}
              onChange={(event) => setNameEn(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </DashboardField>
          <DashboardField label={t("roles.nameFaLabel")}>
            <Input
              size="control-md"
              dir="rtl"
              value={nameFa}
              maxLength={60}
              onChange={(event) => setNameFa(event.target.value)}
              onBlur={() => setTouched(true)}
            />
          </DashboardField>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className={FIELD_LABEL}>{t("roles.permissionsLabel")}</legend>
        {PERMISSION_GROUPS.map((group) => {
          const shown = group.permissions.filter((permission) => ASSIGNABLE.has(permission));
          if (shown.length === 0) return null;
          return (
            <div key={group.key} className="flex flex-col gap-2">
              <span className={OVERLINE}>{t(`permissionGroup.${group.key}`)}</span>
              <ul className="flex flex-col gap-2">
                {shown.map((permission) => {
                  const locked = LOCKED.includes(permission);
                  const id = `permission-${permission}`;
                  return (
                    <li key={permission} className="flex items-start gap-3">
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={chosen.has(permission)}
                        disabled={locked}
                        onCheckedChange={(value) => toggle(permission, value === true)}
                      />
                      <label htmlFor={id} className="flex min-w-0 flex-col">
                        <span className={FIELD_LABEL}>{t(`permission.${permission}.label`)}</span>
                        <span className={FIELD_HINT}>
                          {locked ? t("roles.alwaysOn") : t(`permission.${permission}.description`)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <p className={FIELD_HINT}>{t("roles.teamManageNote")}</p>
      </fieldset>
    </DashboardDialog>
  );
}
