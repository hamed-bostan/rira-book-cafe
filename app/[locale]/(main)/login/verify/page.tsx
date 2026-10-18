import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import OtpScreen from "@/src/presentation/auth/OtpScreen";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return noIndexMetadata(t("verifyTitle"));
}

interface VerifyPageProps {
  searchParams: Promise<{ phone?: string; callbackUrl?: string }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { phone, callbackUrl } = await searchParams;

  // Reached without a phone (e.g. direct nav) → start the flow over.
  if (!phone) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-md">
      <OtpScreen phone={phone} callbackUrl={callbackUrl} />
    </div>
  );
}
