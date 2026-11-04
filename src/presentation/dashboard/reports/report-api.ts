import type { ReportTable } from "@/src/domain/use-cases/analytics/Reports";
import { apiClient } from "@/src/lib/api/client";
import { REPORT_TABLE_SLUGS } from "@/src/lib/api/report-csv";

/**
 * Where the browser downloads a report's tables as CSV. Plain links rather than
 * calls: the browser saves the file, and the session cookie goes with it.
 */
export const reportsExports = {
  tableHref(table: ReportTable, params: Record<string, string>): string {
    return apiClient.getUri({ url: `/admin/reports/export/${REPORT_TABLE_SLUGS[table]}`, params });
  },
};
