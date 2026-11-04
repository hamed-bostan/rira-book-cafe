import { getTranslations } from "next-intl/server";

import { SYSTEM_ACTOR, type ActivityChange, type ActivityEntry } from "@/src/domain/entities/ActivityEntry";
import { cafeDayOf, CAFE_TIME_ZONE } from "@/src/domain/entities/CafeTime";
import { jalaliDayLabel } from "@/src/domain/entities/JalaliCalendar";
import type { RoleName } from "@/src/domain/entities/Role";
import { ROLE_CHANGE_FIELD, roleChangeKind, roleMove } from "@/src/domain/entities/RoleChange";
import { isBuiltInRole, toUserRole, type UserRole } from "@/src/domain/entities/User";
import type { Locale } from "@/src/i18n/routing";

import { CSV_BOM, csvLine } from "../csv";

/**
 * The activity log as spreadsheet rows, in the reader's language: when (Tehran
 * time; the Persian calendar in Persian), who, the area, the sentence the page
 * shows, the thing it's about, and every value that moved as "field: before →
 * after". The entries arrive already narrowed and redacted for the reader.
 */
export async function* activityCsv(
  batches: AsyncIterable<ActivityEntry[]>,
  locale: Locale,
  roleNames: Readonly<Record<string, RoleName>>,
): AsyncGenerator<string> {
  const t = await getTranslations<"dashActivity">({ locale, namespace: "dashActivity" });
  const loose = t as unknown as LooseTranslator;

  const roleName = (role: UserRole | undefined): string => {
    if (!role) return t("roleName.customer");
    if (isBuiltInRole(role)) return t(`roleName.${role}`);
    const name = roleNames[role];
    return name ? (locale === "fa" ? name.fa : name.en) : t("roleName.custom");
  };

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAFE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const when = (at: Date): string => {
    const day = cafeDayOf(at);
    return `${locale === "fa" ? jalaliDayLabel(day) : day} ${time.format(at)}`;
  };

  const sentence = (entry: ActivityEntry): string => {
    const actor = entry.actorId === SYSTEM_ACTOR.id ? t("systemActor") : entry.actorName;
    const label = entry.entityLabel ?? entry.entityId;
    const plain = { b: (chunks: string) => chunks };
    if (entry.action === "user.roleChanged") {
      const move = roleMove(entry.changes);
      const kind = roleChangeKind({ userId: entry.entityId, actorId: entry.actorId, changes: entry.changes });
      return t.markup(`role.${kind}`, {
        actor,
        user: label,
        role: roleName(move?.toRole),
        from: roleName(move?.fromRole),
        to: roleName(move?.toRole),
        ...plain,
      });
    }
    if (entry.action === "promoCode.activeChanged") {
      const after = entry.changes.find((change) => change.field === "isActive")?.after;
      const state = after === "true" ? "on" : after === "false" ? "off" : "unknown";
      return t.markup("action.promoCode.activeChanged", { actor, entity: label, state, ...plain });
    }
    return t.markup(`action.${entry.action}`, { actor, entity: label, ...plain });
  };

  const value = (change: ActivityChange, side: string | null): string => {
    if (side === null) return "—";
    if (side === "true") return t("value.yes");
    if (side === "false") return t("value.no");
    if (change.field === ROLE_CHANGE_FIELD) return roleName(toUserRole(side));
    return side;
  };
  const changes = (entry: ActivityEntry): string =>
    entry.changes
      .map((change) => {
        const key = `field.${change.field}`;
        const field = loose.has(key) ? loose(key) : change.field;
        return `${field}: ${value(change, change.before)} → ${value(change, change.after)}`;
      })
      .join("; ");

  yield CSV_BOM + csvLine([t("csv.when"), t("csv.who"), t("csv.area"), t("csv.what"), t("csv.item"), t("csv.changes")]);
  for await (const batch of batches) {
    yield batch
      .map((entry) =>
        csvLine([
          when(entry.at),
          entry.actorId === SYSTEM_ACTOR.id ? t("systemActor") : entry.actorName,
          t(`entity.${entry.entityType}`),
          sentence(entry),
          entry.entityLabel ?? entry.entityId,
          changes(entry),
        ]),
      )
      .join("");
  }
}

/** The translator through a signature that takes a runtime-built key, checked by `has` (see `ActivityEntryRow`). */
type LooseTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};
