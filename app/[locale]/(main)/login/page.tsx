import { getTranslations } from "next-intl/server";

import LoginScreen from "@/src/presentation/auth/LoginScreen";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("signIn"));
}

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-md">
      <LoginScreen callbackUrl={callbackUrl} />
    </div>
  );
}
