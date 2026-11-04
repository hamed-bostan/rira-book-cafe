"use client";

import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

export type ReportExportItem = { key: string; label: string; href: string };

type ReportExportMenuProps = {
  /** The button's text ("Export CSV"). */
  label: string;
  /** One download per table on the report. */
  items: readonly ReportExportItem[];
};

/**
 * Downloads one of the report's tables as a spreadsheet file — the range and the
 * options on screen, every row rather than the ones that fit. Each item is a plain
 * link: the browser saves the file, and the session cookie goes with it.
 */
export function ReportExportMenu({ label, items }: ReportExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="control-md" className="px-3">
          <Icon icon={Download} size="icon-md" className="me-2" />
          {label}
          <Icon icon={ChevronDown} size="icon-md" className="ms-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild>
            <a href={item.href} download>
              {item.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
