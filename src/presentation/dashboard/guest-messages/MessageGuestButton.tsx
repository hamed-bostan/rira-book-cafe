"use client";

import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { MessageGuestDialog, type MessageGuestAbout, type MessageGuestTarget } from "./MessageGuestDialog";

type MessageGuestButtonProps = {
  guest: MessageGuestTarget;
  about: MessageGuestAbout;
  /**
   * How it sits in the row: `inline` beside the guest's phone (reads like the phone
   * link, a full 44px to the touch on a phone without moving the line), `secondary`
   * among a row's buttons, `icon` among icon buttons.
   */
  appearance?: "inline" | "secondary" | "icon";
};

/**
 * The "Message guest" control for a row: opens {@link MessageGuestDialog}. Drop it
 * in beside the guest's phone or among the row's actions; render it only for a
 * viewer who manages the thing (the endpoint re-checks).
 */
export function MessageGuestButton({ guest, about, appearance = "inline" }: MessageGuestButtonProps) {
  const t = useTranslations("dashGuestMessages");
  const [open, setOpen] = React.useState(false);
  const aria = t("actionAria", { name: guest.name });

  return (
    <>
      {appearance === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="control-md"
          iconOnly
          aria-label={aria}
          title={aria}
          onClick={() => setOpen(true)}
          className="text-muted-foreground hover:bg-muted hover:text-primary"
        >
          <Icon icon={MessageSquareText} size="icon-md" />
        </Button>
      ) : (
        <Button
          type="button"
          variant={appearance === "secondary" ? "secondary" : "ghost"}
          size="control-sm"
          aria-label={aria}
          onClick={() => setOpen(true)}
          className={
            appearance === "secondary"
              ? "px-2"
              : "-my-3 font-normal whitespace-nowrap text-foreground/80 hover:text-primary sm:-my-1.5"
          }
        >
          <Icon icon={MessageSquareText} size="icon-md" className="me-1.5 text-muted-foreground" />
          {t("action")}
        </Button>
      )}
      <MessageGuestDialog open={open} onOpenChange={setOpen} guest={guest} about={about} />
    </>
  );
}
