import type { Employee, PayRun, PayRunDraft } from "@/src/domain/entities/Payroll";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  employeeListResponseSchema,
  payRunDetailResponseSchema,
  payRunDraftResponseSchema,
  payRunListResponseSchema,
  type PayRunDetailWire,
} from "./payroll-response-schema";

/** Server-side payroll reads for the dashboard (BFF). */
export const payRunsServerApi = {
  list(): Promise<PayRun[]> {
    return serverApiGet("/admin/payroll/runs", payRunListResponseSchema);
  },

  /** A run with the entries it posted; `null` on 404. */
  async getById(id: string): Promise<PayRunDetailWire | null> {
    try {
      return await serverApiGet(`/admin/payroll/runs/${id}`, payRunDetailResponseSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  /** What a new run starts from. */
  getDraft(): Promise<PayRunDraft> {
    return serverApiGet("/admin/payroll/runs/draft", payRunDraftResponseSchema);
  },
};

export const employeesServerApi = {
  list(includeInactive: boolean): Promise<Employee[]> {
    return serverApiGet(
      "/admin/payroll/employees",
      employeeListResponseSchema,
      includeInactive ? { params: { all: "true" } } : undefined,
    );
  },
};
