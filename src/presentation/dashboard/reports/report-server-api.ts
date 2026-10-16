import { serverApiGet } from "@/src/lib/api/server-client";

import {
  dashboardOverviewResponseSchema,
  guestReportResponseSchema,
  paymentReportResponseSchema,
  salesReportResponseSchema,
  type DashboardOverviewWire,
  type GuestReportWire,
  type PaymentReportWire,
  type SalesReportWire,
} from "./report-response-schema";

/**
 * Server-side report reads (BFF), fetched during server render. Each report
 * forwards the page's range params verbatim; the route parses them back through
 * `analytics-params`.
 */
export const reportsServerApi = {
  overview(): Promise<DashboardOverviewWire> {
    return serverApiGet("/admin/analytics/overview", dashboardOverviewResponseSchema);
  },

  sales(params: Record<string, string>): Promise<SalesReportWire> {
    return serverApiGet("/admin/reports/sales", salesReportResponseSchema, { params });
  },

  payments(params: Record<string, string>): Promise<PaymentReportWire> {
    return serverApiGet("/admin/reports/payments", paymentReportResponseSchema, { params });
  },

  guests(params: Record<string, string>): Promise<GuestReportWire> {
    return serverApiGet("/admin/reports/guests", guestReportResponseSchema, { params });
  },
};
