import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { sessionAccess } from "@/src/lib/require-permission";
import { SignInAgainNotice } from "@/src/presentation/auth/SignInAgainNotice";
import { TwoFactorChallenge } from "@/src/presentation/auth/TwoFactorChallenge";
import { securityServerApi } from "@/src/presentation/dashboard/security/security-server-api";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";

import type { Metadata } from "next";

// Where this browser stands is read per request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashSecurity");
  return noIndexMetadata(t("challenge.pageTitle"));
}

type TwoFactorPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/** Same-origin dashboard paths only: this page must never become an open redirect. */
function safeCallback(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/**
 * `/login/two-factor` — the dashboard's door after the phone code, for a browser
 * that owes it something: the authenticator app's code, setting the app up (the
 * owner requires it), or a fresh sign-in (a session from before sessions were
 * recorded). A browser that owes nothing goes straight on; a signed-out one starts
 * at the phone.
 */
export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const callbackUrl = safeCallback((await searchParams).callbackUrl);
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  const { gate } = await sessionAccess(session);
  if (gate === "ok") redirect(callbackUrl);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
      {gate === "signInAgain" ? (
        <SignInAgainNotice callbackUrl={callbackUrl} />
      ) : (
        <TwoFactorChallenge
          mode={gate}
          available={(await securityServerApi.getTwoFactor()).available}
          callbackUrl={callbackUrl}
        />
      )}
    </div>
  );
}
