import { REVIEW_RATINGS } from "@/src/domain/entities/ProductReview";
import { REVIEW_VIEWS, type ReviewView } from "@/src/domain/repositories/IReviewRepository";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";
import { reviewsServerApi } from "@/src/presentation/dashboard/reviews/review-server-api";
import { ReviewsScreen } from "@/src/presentation/dashboard/reviews/ReviewsScreen";

// The review queue is fetched over the REST API (BFF) during server render, one
// page at a time. The view (`?view=`, default pending), search (`?q=`), item
// (`?productId=`), stars (`?rating=`) and paging live in the query string; the tab
// counts and the average under the heading ignore the filters.
export const dynamic = "force-dynamic";

type DashboardReviewsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VIEW_SET = new Set<string>(REVIEW_VIEWS);
const RATING_SET = new Set<string>(REVIEW_RATINGS.map(String));

export default async function DashboardReviewsPage({ searchParams }: DashboardReviewsPageProps) {
  await requirePermission("reviews.moderate");
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  const viewParam = params.get("view");
  const view = viewParam && VIEW_SET.has(viewParam) ? (viewParam as ReviewView) : "pending";
  params.set("view", view);
  const q = params.get("q")?.trim() || undefined;
  const productId = params.get("productId")?.trim() || undefined;
  const ratingParam = params.get("rating");
  const stars = ratingParam && RATING_SET.has(ratingParam) ? Number(ratingParam) : undefined;

  const [reviews, counts, average, products] = await Promise.all([
    reviewsServerApi.list(params),
    reviewsServerApi.counts(),
    reviewsServerApi.getRating(),
    reviewsServerApi.reviewedProducts(),
  ]);

  return (
    <ReviewsScreen
      reviews={reviews}
      counts={counts}
      rating={average}
      view={view}
      query={q}
      productId={productId}
      stars={stars}
      products={products}
    />
  );
}
