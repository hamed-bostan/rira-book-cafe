import type { CafeTableFormInput } from "@/src/contracts/cafe-table-schema";
import type { CafeTable, CafeTableMoveDirection } from "@/src/domain/entities/CafeTable";
import { apiDelete, apiPost, apiPut } from "@/src/lib/api/client";

import { cafeTableResponseSchema } from "./cafe-table-response-schema";

/** Typed client for the floor's tables: add, change, move along the floor, remove. Reads are server-side. */
export const cafeTablesApi = {
  create(values: CafeTableFormInput): Promise<CafeTable> {
    return apiPost("/admin/tables", values, cafeTableResponseSchema);
  },

  update(id: string, values: CafeTableFormInput): Promise<CafeTable> {
    return apiPut(`/admin/tables/${id}`, values, cafeTableResponseSchema);
  },

  /** Move a table one place along the floor order. */
  move(id: string, direction: CafeTableMoveDirection): Promise<void> {
    return apiPost(`/admin/tables/${id}/move`, { direction });
  },

  remove(id: string): Promise<void> {
    return apiDelete(`/admin/tables/${id}`);
  },
};
