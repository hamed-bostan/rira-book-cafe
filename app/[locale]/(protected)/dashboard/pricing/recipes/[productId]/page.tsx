import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/src/lib/require-permission";
import { DashboardBackLink } from "@/src/presentation/dashboard/DashboardBackLink";
import {
  ingredientsServerApi,
  pricingServerApi,
  recipesServerApi,
} from "@/src/presentation/dashboard/pricing/pricing-server-api";
import { RecipeForm } from "@/src/presentation/dashboard/pricing/RecipeForm";

export const dynamic = "force-dynamic";

type RecipePageProps = { params: Promise<{ productId: string }> };

export default async function RecipePage({ params }: RecipePageProps) {
  await requirePermission("accounting.write");
  const { productId } = await params;
  const [t, report, lines, ingredients] = await Promise.all([
    getTranslations("dashPricing"),
    pricingServerApi.getReport(),
    recipesServerApi.getByProductId(productId),
    ingredientsServerApi.list(true),
  ]);
  const item = report.rows.find((row) => row.productId === productId);
  if (!item) notFound();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardBackLink href="/dashboard/pricing">{t("heading")}</DashboardBackLink>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("recipe.title", { name: item.name })}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("recipe.subtitle")}</p>
      </div>
      <RecipeForm productId={productId} lines={lines} ingredients={ingredients} />
    </div>
  );
}
