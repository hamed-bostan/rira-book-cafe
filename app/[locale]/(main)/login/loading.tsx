import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/**
 * Sign-in placeholder (also covers /login/verify). Without it the nearest
 * boundary is the home page's skeleton, which would flash the wrong layout.
 * Mirrors LoginScreen: centred heading block, the phone field, the submit.
 */
export default function LoginLoading() {
  return (
    <LoadingRegion className="mx-auto w-full max-w-md">
      <div className="flex min-h-dvh flex-col px-6 pb-10">
        <div className="mb-16 flex flex-col items-center gap-2 pt-16">
          <Skeleton className="h-7 w-48 rounded-button" />
          <Skeleton className="h-5 w-64 rounded-pill" />
        </div>
        <div className="flex flex-col gap-8">
          <div className="min-h-28">
            <Skeleton className="h-12 w-full rounded-input" />
          </div>
          <Skeleton className="h-12 w-full rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
