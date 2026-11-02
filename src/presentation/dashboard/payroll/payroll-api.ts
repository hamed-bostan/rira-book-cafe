import type { PayExpenseInput } from "@/src/contracts/expense-schema";
import type { EmployeeFormInput, PayRunFormInput } from "@/src/contracts/payroll-schema";
import type { Employee, PayRun } from "@/src/domain/entities/Payroll";
import { apiPost, apiPut } from "@/src/lib/api/client";

import { employeeResponseSchema, payRunResponseSchema } from "./payroll-response-schema";

/** Typed client for payroll writes; each books its journal entries server-side. */
export const payRunsApi = {
  create(values: PayRunFormInput): Promise<PayRun> {
    return apiPost("/admin/payroll/runs", values, payRunResponseSchema);
  },

  pay(id: string, values: PayExpenseInput): Promise<PayRun> {
    return apiPost(`/admin/payroll/runs/${id}/pay`, values, payRunResponseSchema);
  },

  /** Reverses everything the run posted, dated today, and frees its month. */
  void(id: string, reason: string): Promise<PayRun> {
    return apiPost(`/admin/payroll/runs/${id}/void`, { reason }, payRunResponseSchema);
  },
};

export const employeesApi = {
  create(values: EmployeeFormInput): Promise<Employee> {
    return apiPost("/admin/payroll/employees", values, employeeResponseSchema);
  },

  update(id: string, values: EmployeeFormInput): Promise<Employee> {
    return apiPut(`/admin/payroll/employees/${id}`, values, employeeResponseSchema);
  },
};
