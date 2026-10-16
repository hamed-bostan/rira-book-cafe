import LoginScreen from "@/src/presentation/auth/LoginScreen";

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
