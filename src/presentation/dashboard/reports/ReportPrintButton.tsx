"use client";

import { Printer } from "lucide-react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** Opens the browser's print dialog; the shell and the report's controls drop away on paper. */
export function ReportPrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => window.print()}>
      <Icon icon={Printer} size="icon-md" className="me-2" />
      {label}
    </Button>
  );
}
