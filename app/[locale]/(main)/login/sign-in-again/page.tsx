import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { sessionAccess } from "@/src/lib/require-permission";
import { SignInAgainNotice } from "@/src/presentation/auth/SignInAgainNotice";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";

import type { Metadata } from "next";
import type { ReactElement } from "react";

// Where this browser stands is read per request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashSecurity");
  return noIndexMetadata(t("signInAgain.title"));
}

type SignInAgainPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/** Same-origin dashboard paths only: this page must never become an open redirect. */
function safeCallback(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/**
 * `/login/sign-in-again` — for a dashboard user whose browser was signed in before
 * sessions were recorded: that session can't be signed out remotely, so it doesn't
 * open the dashboard until they sign in once more. A browser that's fine goes
 * straight on; a signed-out one starts at the phone.
 */
export default async function SignInAgainPage({ searchParams }: SignInAgainPageProps): Promise<ReactElement> {
  const callbackUrl = safeCallback((await searchParams).callbackUrl);
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  const { gate } = await sessionAccess(session);
  if (gate === "ok") redirect(callbackUrl);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
      <SignInAgainNotice callbackUrl={callbackUrl} />
    </div>
  );
}
