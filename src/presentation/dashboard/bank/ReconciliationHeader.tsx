"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardPageHeader } from "../DashboardPageHeader";

import { AddStatementLinesForm } from "./AddStatementLinesForm";

import type { ReactNode } from "react";

type ReconciliationHeaderProps = {
  title: string;
  subtitle: string;
  badge: ReactNode;
  statementId: string;
  /** The day a typed line starts on. */
  defaultDay: string;
  /** The statement is open and the viewer can write to the books. */
  canAddLines: boolean;
};

/** The top of a statement, and the add-lines form its header button opens just below it. */
export function ReconciliationHeader({
  title,
  subtitle,
  badge,
  statementId,
  defaultDay,
  canAddLines,
}: ReconciliationHeaderProps) {
  const t = useTranslations("dashBank");
  const [adding, setAdding] = React.useState(false);

  return (
    <>
      <DashboardPageHeader
        backHref="/dashboard/accounting/bank"
        backLabel={t("heading")}
        title={title}
        subtitle={subtitle}
        badge={badge}
        actions={
          canAddLines ? (
            <Button
              type="button"
              variant="secondary"
              size="control-md"
              className="px-3"
              onClick={() => setAdding(true)}
            >
              <Icon icon={Plus} size="icon-md" className="me-2" />
              {t("addLines.open")}
            </Button>
          ) : undefined
        }
      />
      {canAddLines ? (
        <AddStatementLinesForm
          statementId={statementId}
          defaultDay={defaultDay}
          open={adding}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
