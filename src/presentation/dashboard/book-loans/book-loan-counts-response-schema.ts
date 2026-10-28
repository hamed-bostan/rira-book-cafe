import { z } from "zod/mini";

import type { BookLoanCounts } from "@/src/domain/repositories/IBookLoanRepository";

/** What `GET /api/admin/book-loans/counts` returns, validated at the typed-service boundary. */
export const bookLoanCountsResponseSchema = z.object({
  open: z.number(),
  overdue: z.number(),
  returned: z.number(),
  lost: z.number(),
  all: z.number(),
}) satisfies z.ZodMiniType<BookLoanCounts>;
