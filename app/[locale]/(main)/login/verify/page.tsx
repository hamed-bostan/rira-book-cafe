import { redirect } from "next/navigation";

import OtpScreen from "@/src/presentation/auth/OtpScreen";

interface VerifyPageProps {
  searchParams: Promise<{ phone?: string; callbackUrl?: string }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { phone, callbackUrl } = await searchParams;

  // Reached without a phone (e.g. direct nav) → start the flow over.
  if (!phone) redirect("/login");

  return <OtpScreen phone={phone} callbackUrl={callbackUrl} />;
}
