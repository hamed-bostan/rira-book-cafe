import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { requirePermission } from "@/src/lib/require-permission";
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
    <div className="flex max-w-2xl flex-col gap-6">
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-2 text-body-caption text-muted-foreground"
      >
        <Link href="/dashboard/pricing" className="hover:text-foreground">
          {t("heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{item.name}</span>
      </nav>
      <div>
        <h1 className="dashboard-page-title">{t("recipe.title", { name: item.name })}</h1>
        <p className="text-body-small text-muted-foreground">{t("recipe.subtitle")}</p>
      </div>
      <RecipeForm productId={productId} lines={lines} ingredients={ingredients} />
    </div>
  );
}
