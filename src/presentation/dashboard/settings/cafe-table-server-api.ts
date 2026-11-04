import type { CafeTable } from "@/src/domain/entities/CafeTable";
import { serverApiGet } from "@/src/lib/api/server-client";

import { cafeTableListResponseSchema } from "./cafe-table-response-schema";

/** Server-side reads of the floor's tables (BFF), fetched during server render. */
export const cafeTablesServerApi = {
  /** Every table, in use or not, in floor order. */
  list(): Promise<CafeTable[]> {
    return serverApiGet("/admin/tables", cafeTableListResponseSchema);
  },
};
