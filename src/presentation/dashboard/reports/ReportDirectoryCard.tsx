import { ChevronRight, type LucideIcon } from "lucide-react";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon, focusRing } from "@/src/presentation/design-system";

export type ReportDirectoryItem = { id: string; title: string; description: string; href: string; icon: LucideIcon; tone: "green" | "red" | "blue" | "violet" };
type Props = { item: ReportDirectoryItem; openAria: string; fullWidth: boolean };

const TONE_STYLES: Record<ReportDirectoryItem["tone"], { icon: string; card: string; accent: string }> = {
  green: { icon: "bg-accent text-primary ring-primary/10", card: "hover:border-primary/25", accent: "bg-primary" },
  red: { icon: "bg-error text-destructive ring-destructive/10", card: "hover:border-destructive/25", accent: "bg-destructive" },
  blue: { icon: "bg-info text-info-foreground ring-info-foreground/10", card: "hover:border-info-foreground/25", accent: "bg-info-foreground" },
  violet: { icon: "bg-muted text-magenta ring-magenta/10", card: "hover:border-magenta/25", accent: "bg-magenta" },
};

export function ReportDirectoryCard({ item, openAria, fullWidth }: Props) {
  const tone = TONE_STYLES[item.tone];

  return (
    <Link
      href={item.href}
      aria-label={openAria}
      className={cn(focusRing, "group relative flex min-h-28 items-center gap-3 overflow-hidden rounded-card-lg border border-border/80 bg-background p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card sm:gap-4 sm:p-5", tone.card, fullWidth && "md:col-span-2")}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-4 start-0 w-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100", tone.accent)} />
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-card-lg ring-1 ring-inset sm:size-14", tone.icon)}>
        <Icon icon={item.icon} size="md" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-bold text-foreground transition-colors group-hover:text-primary">{item.title}</span>
        <span className="mt-1 block max-w-2xl text-body-small-strong leading-relaxed text-muted-foreground">{item.description}</span>
      </span>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted-foreground transition-[color,background-color,transform] group-hover:translate-x-0.5 group-hover:bg-accent group-hover:text-primary rtl:group-hover:-translate-x-0.5">
        <Icon icon={ChevronRight} size="sm" className="rtl:rotate-180" />
      </span>
    </Link>
  );
}
