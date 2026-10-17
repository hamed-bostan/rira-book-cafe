import { REVIEW_VIEWS, type ReviewView } from "@/src/domain/repositories/IReviewRepository";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { reviewsServerApi } from "@/src/presentation/dashboard/reviews/review-server-api";
import { ReviewsScreen } from "@/src/presentation/dashboard/reviews/ReviewsScreen";

// The review queue is fetched over the REST API (BFF) during server render. The
// view (`?view=`, default pending) and search (`?q=`) live in the query string.
export const dynamic = "force-dynamic";

type DashboardReviewsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VIEW_SET = new Set<string>(REVIEW_VIEWS);

export default async function DashboardReviewsPage({ searchParams }: DashboardReviewsPageProps) {
  await requirePermission("reviews.moderate");
  const params = toSearchParams(await searchParams);
  const viewParam = params.get("view");
  const view = viewParam && VIEW_SET.has(viewParam) ? (viewParam as ReviewView) : "pending";
  const q = params.get("q")?.trim() || undefined;

  const [reviews, counts] = await Promise.all([reviewsServerApi.list(view, q), reviewsServerApi.counts()]);

  return <ReviewsScreen reviews={reviews} counts={counts} isSearching={q !== undefined} />;
}
