import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

export type ReportSegmentedOption = { key: string; label: string; href: string };

type ReportSegmentedLinksProps = {
  /** Names the switch for assistive tech ("Date range"). */
  label: string;
  options: readonly ReportSegmentedOption[];
  /** The `key` of the option in force — none is lifted when it matches nothing (a custom range). */
  current: string;
};

/**
 * A few-way switch whose options are links: the chosen one lifts off the well as a
 * white chip. A link rather than client state because what it switches — the
 * range, the ranking — is read on the server, and lives in the URL.
 */
export function ReportSegmentedLinks({ label, options, current }: ReportSegmentedLinksProps) {
  return (
    <nav aria-label={label} className="flex shrink-0 rounded-button bg-muted p-0.5">
      {options.map((option) => {
        const selected = option.key === current;
        return (
          <Link
            key={option.key}
            href={option.href}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "flex h-11 items-center rounded-button px-3 text-body-default whitespace-nowrap transition-colors sm:h-8 sm:text-body-small",
              focusRing,
              selected
                ? "bg-background font-semibold text-foreground shadow-xs"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
