import { Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { netPaid } from "@/src/domain/entities/IncomeRefund";
import { suiteNights, type SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { suiteStayMoney } from "@/src/domain/entities/SuitePricing";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { SuiteRateButton } from "./SuiteRateButton";

type SuiteStayMoneyProps = {
  booking: SuiteBooking;
  /** "3 nights · Oct 22 → Oct 25", for the rate dialog. */
  nightsLabel: string;
  /** A viewer who keeps the books may price this stay differently. */
  canSetRate: boolean;
};

/**
 * A stay's money on one line: the total (nights × its rate), what's been paid
 * and handed back, and what's still due — or, for a stay that ended without the
 * guest staying, what's due back to them.
 */
export async function SuiteStayMoney({ booking, nightsLabel, canSetRate }: SuiteStayMoneyProps) {
  const t = await getTranslations("dashSuite");
  const locale = await getLocale();
  const money = suiteStayMoney(booking);
  const ended = booking.status === "cancelled" || booking.status === "noShow";
  const back = netPaid(booking);

  const parts: { text: string; tone?: string }[] = [];
  if (!ended && money.total === undefined) {
    parts.push({ text: t("money.noRate"), tone: "text-muted-foreground" });
  } else if (!ended && money.total !== undefined) {
    parts.push(
      { text: t("money.total", { amount: formatMoney(money.total, locale) }), tone: "text-foreground" },
      {
        text: t("money.rate", { amount: formatMoney(booking.nightlyRate ?? 0, locale) }),
        tone: "text-muted-foreground",
      },
    );
  }
  if (money.paid > 0) parts.push({ text: t("paid", { amount: formatMoney(money.paid, locale) }) });
  if (money.refunded > 0) parts.push({ text: t("money.refunded", { amount: formatMoney(money.refunded, locale) }) });
  if (ended && back > 0) {
    parts.push({ text: t("money.refundDue", { amount: formatMoney(back, locale) }), tone: "text-warning-foreground" });
  } else if (!ended && money.balance !== undefined) {
    if (money.balance > 0) {
      parts.push({ text: t("money.due", { amount: formatMoney(money.balance, locale) }), tone: "font-semibold" });
    } else if (money.balance < 0) {
      parts.push({
        text: t("money.overpaid", { amount: formatMoney(-money.balance, locale) }),
        tone: "text-warning-foreground",
      });
    } else if (money.paid > 0) {
      parts.push({ text: t("money.settled"), tone: "text-success-foreground" });
    }
  }
  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-default text-foreground/80 tabular-nums sm:text-body-small">
      <Icon icon={Wallet} size="icon-md" className="shrink-0 text-muted-foreground" />
      {parts.map((part, index) => (
        <span key={part.text} className="flex items-center gap-1.5 whitespace-nowrap">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span className={cn(part.tone)}>{part.text}</span>
        </span>
      ))}
      {canSetRate && !ended ? (
        <SuiteRateButton
          stayId={booking.id}
          reference={booking.reference}
          nights={suiteNights(booking.checkIn, booking.checkOut)}
          nightsLabel={nightsLabel}
          nightlyRate={booking.nightlyRate}
        />
      ) : null}
    </div>
  );
}
