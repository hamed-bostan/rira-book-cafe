import * as z from "./zod";

/**
 * The server's environment, validated. Every server-side read of configuration
 * goes through `getEnv()` rather than `process.env.X`, so a typo'd or missing
 * variable fails loudly in one place instead of quietly selecting a fallback
 * (e.g. the mock OTP provider) somewhere deep in a request.
 *
 * `instrumentation.ts` parses it once when the server boots, so a bad deployment
 * refuses to start instead of half-working. (`NEXT_PUBLIC_*` values read in browser
 * code stay as literal `process.env.NEXT_PUBLIC_X` — Next inlines those at build.)
 *
 * Env files write unset values as `KEY=`; empty strings count as "not set".
 */

const emptyToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const optionalString = z.pipe(z.transform(emptyToUndefined), z.optional(z.string().check(z.trim(), z.minLength(1))));
const optionalUrl = z.pipe(z.transform(emptyToUndefined), z.optional(z.string().check(z.trim(), z.url())));
const optionalPositiveInt = z.pipe(
  z.transform(emptyToUndefined),
  z.optional(z.coerce.number().check(z.int(), z.positive())),
);
const positiveIntOr = (fallback: number) =>
  z.pipe(z.transform(emptyToUndefined), z._default(z.coerce.number().check(z.int(), z.positive()), fallback));
/** `"true"` → true; unset or `"false"` → false; anything else is a typo worth failing on. */
const flag = z.pipe(
  z.pipe(z.transform(emptyToUndefined), z.optional(z.enum(["true", "false"]))),
  z.transform((value) => value === "true"),
);

const MIN_AUTH_SECRET_LENGTH = 32;

const baseSchema = z.object({
  NODE_ENV: z._default(z.enum(["development", "production", "test"]), "development"),

  // Read by Prisma itself; validated here so a bad value fails at boot, not on the first query.
  DATABASE_URL: z.pipe(
    z.transform(emptyToUndefined),
    z.optional(
      z.string().check(
        z.trim(),
        z.refine(
          (value) => /^postgres(ql)?:\/\//.test(value),
          "DATABASE_URL must be a postgresql:// connection string.",
        ),
      ),
    ),
  ),

  AUTH_SECRET: optionalString,
  /** Break-glass owner ids, comma-separated normalized phones. */
  ADMIN_USER_IDS: z.pipe(
    z.pipe(z.transform(emptyToUndefined), z.optional(z.string())),
    z.transform((value) =>
      (value ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ),

  SMS_IR_API_KEY: optionalString,
  SMS_IR_TEMPLATE_ID: optionalPositiveInt,
  SMS_IR_BASE_URL: optionalUrl,
  SMS_IR_ADMIN_INVITE_TEMPLATE_ID: optionalPositiveInt,
  SMS_IR_OWNERSHIP_RECEIVED_TEMPLATE_ID: optionalPositiveInt,
  SMS_IR_OWNERSHIP_LOST_TEMPLATE_ID: optionalPositiveInt,
  OTP_MOCK: flag,

  UPLOADS_DIR: optionalString,
  API_BASE_URL: optionalUrl,
  APP_URL: optionalUrl,
  NEXT_PUBLIC_SITE_URL: optionalUrl,

  SMTP_HOST: optionalString,
  SMTP_PORT: positiveIntOr(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM: optionalString,

  ZARINPAL_MERCHANT_ID: optionalString,
  ZARINPAL_SANDBOX: flag,

  /** Reverse proxies in front of the app whose `X-Forwarded-For` entry is trusted (the host nginx = 1). */
  TRUSTED_PROXY_HOPS: positiveIntOr(1),
});

export type Env = z.output<typeof baseSchema>;

/**
 * Rules spanning several variables, plus the required ones. `strict` is off while
 * `next build` collects page data, which runs without the real secrets.
 */
function crossFieldRules(env: Env, ctx: z.core.$RefinementCtx, strict: boolean): void {
  if (strict && !env.DATABASE_URL) {
    ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "DATABASE_URL is required." });
  }

  if (env.SMS_IR_API_KEY && !env.SMS_IR_TEMPLATE_ID && !env.OTP_MOCK) {
    ctx.addIssue({
      code: "custom",
      path: ["SMS_IR_TEMPLATE_ID"],
      message: "SMS_IR_TEMPLATE_ID is required when SMS_IR_API_KEY is set (or set OTP_MOCK=true).",
    });
  }

  if (!strict || env.NODE_ENV !== "production") return;

  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < MIN_AUTH_SECRET_LENGTH) {
    ctx.addIssue({
      code: "custom",
      path: ["AUTH_SECRET"],
      message: `AUTH_SECRET is required in production (at least ${MIN_AUTH_SECRET_LENGTH} characters — \`npx auth secret\`).`,
    });
  }
}

/** Parse and validate an environment; throws one error listing every problem. */
export function parseEnv(source: Record<string, string | undefined>, options: { strict?: boolean } = {}): Env {
  const schema = baseSchema.check(z.superRefine((env, ctx) => crossFieldRules(env, ctx, options.strict ?? true)));
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
}

/**
 * Non-fatal concerns worth shouting about at boot: configurations that work but
 * shouldn't be running in production.
 */
export function envWarnings(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];

  const warnings: string[] = [];
  const realSms = Boolean(env.SMS_IR_API_KEY && env.SMS_IR_TEMPLATE_ID) && !env.OTP_MOCK;
  if (!realSms) {
    warnings.push(
      "Sign-in is using the MOCK OTP provider, which shows the code on screen: anyone can sign in as any phone, including an owner. Configure SMS_IR_API_KEY + SMS_IR_TEMPLATE_ID.",
    );
  }
  if (!env.APP_URL) {
    warnings.push("APP_URL is not set: invitation links and the payment callback trust the request's Host header.");
  }
  if (!env.ZARINPAL_MERCHANT_ID || env.ZARINPAL_SANDBOX) {
    warnings.push("Zarinpal is in sandbox mode: online payments don't move real money.");
  }
  return warnings;
}

let cached: Env | undefined;

/** The validated environment, parsed on first use and memoized for the process. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env, { strict: process.env.NEXT_PHASE !== "phase-production-build" });
  return cached;
}
