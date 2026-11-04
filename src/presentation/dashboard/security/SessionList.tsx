"use client";

import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { SESSION_TOUCH_INTERVAL_MS } from "@/src/domain/entities/UserSession";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { formatRelativeTime } from "@/src/lib/formatRelativeTime";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { ROW_CAPTION, ROW_TEXT } from "@/src/presentation/dashboard/pageStyles";
import type { SessionWire } from "@/src/presentation/dashboard/team/security-response-schema";
import { teamApi } from "@/src/presentation/dashboard/team/team-api";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { securityApi } from "./security-api";

type SessionListProps = {
  sessions: SessionWire[];
  /**
   * Whose sessions: your own (`self` — this browser is marked and kept), or a team
   * member's, managed by the owner (`member`).
   */
  owner: { kind: "self" } | { kind: "member"; id: string; name: string };
};

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor, unknown: Monitor } as const;

type Pending = { kind: "one"; session: SessionWire } | { kind: "all" } | null;

/**
 * Where someone is signed in: the browser and system each session started on, when
 * it signed in and roughly when it was last used, this browser marked. Each can be
 * signed out, or all of them at once — on your own list "everywhere else", so the
 * button doesn't sign you out of the screen you clicked it on.
 */
export function SessionList({ sessions, owner }: SessionListProps) {
  const t = useTranslations("dashSecurity");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, setConfirm] = React.useState<Pending>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, startTransition] = React.useTransition();
  // When the list was drawn — read once, not on every render, so a re-render can't flip a label.
  const [drawnAt] = React.useState(() => new Date().getTime());

  const others = sessions.filter((session) => !session.current);
  const canRevokeAll = owner.kind === "self" ? others.length > 0 : sessions.length > 0;

  function deviceName(session: SessionWire): string {
    const { browser, os } = session.device;
    if (browser && os) return t("sessions.browserOn", { browser, os });
    return browser ?? os ?? t("sessions.unknownDevice");
  }

  function lastSeen(session: SessionWire): string {
    const idle = drawnAt - new Date(session.lastSeenAt).getTime();
    // Last-seen is only refreshed every few minutes, so anything within two of
    // those intervals is as good as "now".
    return idle < SESSION_TOUCH_INTERVAL_MS * 2
      ? t("sessions.activeNow")
      : t("sessions.lastActive", { when: formatRelativeTime(session.lastSeenAt, locale) });
  }

  function submit(): void {
    if (!confirm) return;
    setError(null);
    startTransition(async () => {
      try {
        if (confirm.kind === "one") {
          await (owner.kind === "self"
            ? securityApi.revokeSession(confirm.session.id)
            : teamApi.revokeMemberSession(owner.id, confirm.session.id));
          toast({ tone: "success", title: t("sessions.signedOutOne") });
        } else {
          await (owner.kind === "self" ? securityApi.revokeOtherSessions() : teamApi.revokeMemberSessions(owner.id));
          toast({
            tone: "success",
            title: t(owner.kind === "self" ? "sessions.signedOutOthers" : "sessions.signedOutAll"),
          });
        }
        setConfirm(null);
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("sessions.error")));
      }
      router.refresh();
    });
  }

  return (
    <DashboardSection
      title={t("sessions.heading")}
      description={
        owner.kind === "self" ? t("sessions.descriptionSelf") : t("sessions.descriptionMember", { name: owner.name })
      }
      flush
    >
      {sessions.length === 0 ? (
        <p className={cn(ROW_CAPTION, "px-5 py-4")}>{t("sessions.empty")}</p>
      ) : (
        <ul aria-label={t("sessions.heading")}>
          {sessions.map((session, index) => (
            <li
              key={session.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3",
                index > 0 && "border-t border-border",
              )}
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <Icon icon={DEVICE_ICON[session.device.kind]} size="sm" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn(ROW_TEXT, "flex flex-wrap items-center gap-2 font-semibold text-foreground")}>
                  {deviceName(session)}
                  {session.current ? (
                    <Badge variant="success" appearance="outline" size="compact">
                      {t("sessions.thisBrowser")}
                    </Badge>
                  ) : null}
                </span>
                <span className={ROW_CAPTION}>
                  {t("sessions.meta", {
                    signedIn: formatOrderDate(session.signedInAt, locale),
                    lastSeen: lastSeen(session),
                  })}
                </span>
              </div>
              {session.current && owner.kind === "self" ? null : (
                <Button
                  size="control-sm"
                  variant="secondary"
                  className="px-3"
                  onClick={() => {
                    setError(null);
                    setConfirm({ kind: "one", session });
                  }}
                  aria-label={t("sessions.signOutAria", { device: deviceName(session) })}
                >
                  {t("sessions.signOut")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canRevokeAll ? (
        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button
            size="control-md"
            variant="secondary"
            className="px-3"
            onClick={() => {
              setError(null);
              setConfirm({ kind: "all" });
            }}
          >
            {owner.kind === "self" ? t("sessions.signOutOthers") : t("sessions.signOutAll")}
          </Button>
        </div>
      ) : null}

      <DashboardDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.kind === "one"
            ? t("sessions.confirmOneTitle", { device: deviceName(confirm.session) })
            : owner.kind === "self"
              ? t("sessions.confirmOthersTitle")
              : t("sessions.confirmAllTitle", { name: owner.name })
        }
        subtitle={t("sessions.confirmMessage")}
        submitLabel={t("sessions.signOut")}
        danger
        pending={busy}
        onSubmit={submit}
        error={error}
      />
    </DashboardSection>
  );
}
