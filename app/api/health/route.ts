import { NextResponse } from "next/server";

import { CheckHealth } from "@/src/domain/use-cases/health/CheckHealth";
import { databaseProbe } from "@/src/infrastructure/container";
import { APP_VERSION } from "@/src/lib/appVersion";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness + readiness for the Docker healthcheck and an
 * external uptime monitor (see `deploy/README.md`). Public, uncached, and fast:
 * the database ping is capped at 2s. 200 when everything is up, 503 when the
 * database is unreachable. The body names the version and each check's state —
 * never hostnames, error text or anything else worth hiding.
 */
export async function GET(): Promise<NextResponse> {
  const report = await new CheckHealth(databaseProbe).execute();

  return NextResponse.json(
    { ...report, version: APP_VERSION, uptimeSeconds: Math.round(process.uptime()) },
    {
      status: report.status === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** Same check, no body — for monitors that probe with HEAD. */
export async function HEAD(): Promise<NextResponse> {
  const report = await new CheckHealth(databaseProbe).execute();
  return new NextResponse(null, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
