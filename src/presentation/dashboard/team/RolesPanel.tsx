import { useLocale, useTranslations } from "next-intl";

import { ASSIGNABLE_PERMISSIONS } from "@/src/contracts/role-schema";
import { cn } from "@/src/lib/utils";
import { ROW_CAPTION } from "@/src/presentation/dashboard/pageStyles";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { NewRoleButton } from "./NewRoleButton";
import { RoleActions } from "./RoleActions";
import { roleBadgeVariant, roleDisplayName, roleNamesOf } from "./roleDisplay";

import type { RoleWire } from "./security-response-schema";

type RolesPanelProps = {
  roles: RoleWire[];
};

/**
 * The roles tab: the built-in support, staff and admin roles — whose permissions
 * the owner can change — and the owner's own, each with how many people hold it
 * and what it may do. The owner role isn't listed: it always holds everything.
 */
export function RolesPanel({ roles }: RolesPanelProps) {
  const t = useTranslations("dashTeam");
  const locale = useLocale();
  const names = roleNamesOf(roles);
  const label = (role: RoleWire): string =>
    roleDisplayName(role.key, {
      builtIn: (builtIn) => t(`role.${builtIn}`),
      names,
      locale,
      fallback: t("customRoleFallback"),
    });

  return (
    <section
      aria-labelledby="roles-heading"
      className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="roles-heading" className="text-body-strong text-foreground">
            {t("roles.heading")}
          </h2>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
            {t("roles.description")}
          </p>
        </div>
        <NewRoleButton />
      </div>
      <ul>
        {roles.map((role, index) => (
          <li
            key={role.key}
            aria-label={label(role)}
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4",
              index > 0 && "border-t border-border",
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={roleBadgeVariant(role.key)} appearance="outline" size="compact" dot>
                  {label(role)}
                </Badge>
                {role.builtIn ? (
                  <span className={ROW_CAPTION}>{t("roles.builtIn")}</span>
                ) : (
                  <span className={ROW_CAPTION}>{t("roles.custom")}</span>
                )}
              </div>
              <span className={ROW_CAPTION}>
                {t("roles.summary", {
                  members: role.memberCount,
                  permissions: role.permissions.length,
                  total: ASSIGNABLE_PERMISSIONS.length,
                })}
              </span>
            </div>
            <RoleActions role={role} label={label(role)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
