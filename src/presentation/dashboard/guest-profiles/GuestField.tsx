"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { MAX_GUEST_PHONE_LENGTH, MAX_GUEST_PROFILE_NAME_LENGTH } from "@/src/domain/entities/GuestProfile";
import { cn } from "@/src/lib/utils";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";

import { DashboardField } from "../DashboardField";
import { FIELD_HINT } from "../fieldStyles";

import { guestFieldValue, type GuestFieldValue } from "./guestFieldValue";
import { GuestLookupLine } from "./GuestLookupLine";
import { useGuestLookup } from "./useGuestLookup";

export type { GuestFieldValue } from "./guestFieldValue";

type GuestFieldProps = {
  /**
   * Called with the guest whenever there's enough to save the record with, and
   * with `null` while there isn't — a number still being typed or looked up, or a
   * new guest with no name yet. Hold the submit button back on `null`.
   */
  onChange: (guest: GuestFieldValue | null) => void;
  /** While the form is saving. */
  disabled?: boolean;
  /** Placement in the form's grid, e.g. `col-span-full`. */
  className?: string;
};

/**
 * Who a sale, booking or stay is for: the guest's phone, looked up as it's typed.
 * A number with a profile says whose ("Sara Ahmadi · has a profile", and whether
 * they've signed in yet); one without asks for the guest's name, and the profile
 * is made with the record. Every staff form that records something for a guest
 * uses it, so finding a guest reads and works the same everywhere.
 *
 * Uncontrolled: it keeps what's typed itself and reports the guest through
 * `onChange`. Remount it (a new `key`, or its dialog closing) to start over.
 * Fills its column; give it `col-span-full` in a `FIELD_GRID`.
 */
export function GuestField({ onChange, disabled, className }: GuestFieldProps) {
  const t = useTranslations("dashGuestProfiles");
  const statusId = React.useId();
  const [phone, setPhone] = React.useState("");
  const [name, setName] = React.useState("");
  const lookup = useGuestLookup(phone);

  const guest: GuestFieldValue | null = guestFieldValue(phone, name, lookup);
  // Reported when it changes, not on every render: the form's state is a new object each time.
  const guestKey = guest ? `${guest.phone}\n${guest.name ?? ""}` : null;
  const report = React.useEffectEvent(() => onChange(guest));
  React.useEffect(() => report(), [guestKey]);

  const asksName =
    lookup?.state === "new" || lookup?.state === "failed" || (lookup?.state === "found" && lookup.match.name === null);

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <DashboardField label={t("phoneLabel")}>
          <Input
            size="control-md"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={MAX_GUEST_PHONE_LENGTH}
            placeholder="0912 345 6789"
            autoComplete="off"
            dir="ltr"
            required
            disabled={disabled}
            aria-describedby={statusId}
          />
        </DashboardField>
        <p id={statusId} role="status" className={cn(FIELD_HINT, "flex items-start gap-1.5")}>
          <GuestLookupLine lookup={lookup} />
        </p>
      </div>
      {asksName ? (
        <DashboardField label={t("nameLabel")}>
          <Input
            size="control-md"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_GUEST_PROFILE_NAME_LENGTH}
            placeholder={t("namePlaceholder")}
            autoComplete="off"
            dir="auto"
            required={lookup?.state !== "failed"}
            disabled={disabled}
          />
        </DashboardField>
      ) : null}
    </div>
  );
}
