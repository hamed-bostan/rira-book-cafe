import type { IActivityLog } from "@/src/domain/repositories/IActivityLog";
import type { IAnalyticsRepository } from "@/src/domain/repositories/IAnalyticsRepository";
import type { IAuthRepository } from "@/src/domain/repositories/IAuthRepository";
import type { ICategoryRepository } from "@/src/domain/repositories/ICategoryRepository";
import type { IEmailSender } from "@/src/domain/repositories/IEmailSender";
import type { IEventRepository } from "@/src/domain/repositories/IEventRepository";
import type { IExpenseRepository } from "@/src/domain/repositories/IExpenseRepository";
import type { IImageStorageRepository } from "@/src/domain/repositories/IImageStorageRepository";
import type { IInventoryRepository } from "@/src/domain/repositories/IInventoryRepository";
import type { ILedgerRepository } from "@/src/domain/repositories/ILedgerRepository";
import type { IOrderNoteRepository } from "@/src/domain/repositories/IOrderNoteRepository";
import type { IOrderRepository } from "@/src/domain/repositories/IOrderRepository";
import type { IPaymentAttemptRepository } from "@/src/domain/repositories/IPaymentAttemptRepository";
import type { IPaymentGateway } from "@/src/domain/repositories/IPaymentGateway";
import type { IPricingRepository } from "@/src/domain/repositories/IPricingRepository";
import type { IProductRepository } from "@/src/domain/repositories/IProductRepository";
import type { IReservationRepository } from "@/src/domain/repositories/IReservationRepository";
import type { ITeamNotifier } from "@/src/domain/repositories/ITeamNotifier";
import type { IUserRepository } from "@/src/domain/repositories/IUserRepository";

import { LoggingEmailSender } from "./email/LoggingEmailSender";
import { SmtpEmailSender } from "./email/SmtpEmailSender";
import { TeamNotifier } from "./notifications/TeamNotifier";
import { ZarinpalPaymentGateway } from "./payments/ZarinpalPaymentGateway";
import { MockAuthRepository } from "./repositories/mock/MockAuthRepository";
import { PrismaActivityLog } from "./repositories/PrismaActivityLog";
import { PrismaAnalyticsRepository } from "./repositories/PrismaAnalyticsRepository";
import { PrismaCategoryRepository } from "./repositories/PrismaCategoryRepository";
import { PrismaEventRepository } from "./repositories/PrismaEventRepository";
import { PrismaExpenseRepository } from "./repositories/PrismaExpenseRepository";
import { PrismaInventoryRepository } from "./repositories/PrismaInventoryRepository";
import { PrismaLedgerRepository } from "./repositories/PrismaLedgerRepository";
import { PrismaOrderNoteRepository } from "./repositories/PrismaOrderNoteRepository";
import { PrismaOrderRepository } from "./repositories/PrismaOrderRepository";
import { PrismaPaymentAttemptRepository } from "./repositories/PrismaPaymentAttemptRepository";
import { PrismaPricingRepository } from "./repositories/PrismaPricingRepository";
import { PrismaProductRepository } from "./repositories/PrismaProductRepository";
import { PrismaReservationRepository } from "./repositories/PrismaReservationRepository";
import { PrismaUserRepository } from "./repositories/PrismaUserRepository";
import { SmsIrAuthRepository } from "./repositories/SmsIrAuthRepository";
import { SupabaseImageStorageRepository } from "./repositories/SupabaseImageStorageRepository";

/**
 * Composition root.
 *
 * The single place that binds domain repository *interfaces* to concrete
 * *implementations*. This is the only module that imports concrete repositories;
 * everything else (use-cases, route handlers) depends on the interfaces —
 * Dependency Inversion in practice. New features add their bindings here.
 */

// Users — PostgreSQL via Prisma. Rows are created on first sign-in
// (auth `authorize` → GetOrCreateUser).
export const userRepository: IUserRepository = new PrismaUserRepository();

// The menu: categories and items (drinks, food, books) — PostgreSQL via Prisma.
export const categoryRepository: ICategoryRepository = new PrismaCategoryRepository();
export const productRepository: IProductRepository = new PrismaProductRepository();

// Orders — PostgreSQL via Prisma. Placement and cancellation move stock in the same
// transaction as the order; internal notes are append-only.
export const orderRepository: IOrderRepository = new PrismaOrderRepository();
export const orderNoteRepository: IOrderNoteRepository = new PrismaOrderNoteRepository();

// Online payments — Zarinpal. Without `ZARINPAL_MERCHANT_ID` (or with
// `ZARINPAL_SANDBOX=true`) payments go to Zarinpal's sandbox, so local dev and
// staging work end to end without moving money. Attempts live in PostgreSQL.
export const paymentGateway: IPaymentGateway = new ZarinpalPaymentGateway({
  merchantId: process.env.ZARINPAL_MERCHANT_ID,
  sandbox: process.env.ZARINPAL_SANDBOX === "true",
});
export const paymentAttemptRepository: IPaymentAttemptRepository = new PrismaPaymentAttemptRepository();

// Table reservations and events (book clubs, readings) — PostgreSQL via Prisma.
// Table clashes and event capacity are enforced inside the repositories under locks.
export const reservationRepository: IReservationRepository = new PrismaReservationRepository();
export const eventRepository: IEventRepository = new PrismaEventRepository();

// Cafe aggregates — revenue, busy hours, best sellers, guests — computed in
// PostgreSQL from the same rows the repositories above write, so there is no
// second copy of the numbers to drift.
export const analyticsRepository: IAnalyticsRepository = new PrismaAnalyticsRepository();

// Accounting — a double-entry general ledger plus expenses and suppliers, in
// PostgreSQL. Orders and expenses post their journal entries inside their own
// transactions; the database itself refuses unbalanced or edited entries.
export const ledgerRepository: ILedgerRepository = new PrismaLedgerRepository();
export const expenseRepository: IExpenseRepository = new PrismaExpenseRepository();

// Pricing — ingredients, recipes and the advisor's settings. Recipes keep each
// item's cost price (what orders snapshot for cost of sales) in step with what
// its ingredients cost.
export const pricingRepository: IPricingRepository = new PrismaPricingRepository();

// Perpetual inventory at average cost. Deliveries, waste, counts and sales move
// stock and post the matching entries in one transaction, so the stock list and
// the Inventory account always agree.
export const inventoryRepository: IInventoryRepository = new PrismaInventoryRepository();

// Append-only audit trail of admin changes. Read-only here: entries are written by
// the repositories that make the changes they describe, inside the same
// transaction, from a `NewActivityEntry` the use-case built (see `AuditHook`).
export const activityLog: IActivityLog = new PrismaActivityLog();

// Real SMS OTP when an SMS.ir key is configured; the in-memory mock otherwise so
// local dev works without credentials (the mock surfaces the code in the UI).
// `OTP_MOCK=true` forces the mock even when a key is present.
const forceMockAuth = process.env.OTP_MOCK === "true";
export const authRepository: IAuthRepository =
  process.env.SMS_IR_API_KEY && process.env.SMS_IR_TEMPLATE_ID && !forceMockAuth
    ? new SmsIrAuthRepository({
        apiKey: process.env.SMS_IR_API_KEY,
        templateId: Number(process.env.SMS_IR_TEMPLATE_ID),
        baseUrl: process.env.SMS_IR_BASE_URL,
      })
    : new MockAuthRepository();

/** Read a numeric env var, returning `undefined` when unset or not a number. */
function numericEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

// Transactional email. Real SMTP when a host is configured, a logging stub
// otherwise, so local dev and a fresh deployment work without mail credentials.
// SMTP rather than a provider HTTP API: hosted mail APIs geo-block Iranian servers.
export const emailSender: IEmailSender = process.env.SMTP_HOST
  ? new SmtpEmailSender({
      host: process.env.SMTP_HOST,
      port: numericEnv("SMTP_PORT") ?? 587,
      // Implicit TLS on 465; STARTTLS on 587 and everything else.
      secure: (numericEnv("SMTP_PORT") ?? 587) === 465,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM ?? "Rira Book Cafe <no-reply@localhost>",
    })
  : new LoggingEmailSender();

// Announces team changes — an admin grant, and both sides of an ownership move —
// over email (when an address is on file) and SMS (when an approved pattern
// template is configured for that event). Best-effort: the change is real either way.
export const teamNotifier: ITeamNotifier = new TeamNotifier(
  emailSender,
  process.env.SMS_IR_API_KEY
    ? {
        apiKey: process.env.SMS_IR_API_KEY,
        baseUrl: process.env.SMS_IR_BASE_URL,
        templates: {
          adminGranted: numericEnv("SMS_IR_ADMIN_INVITE_TEMPLATE_ID"),
          ownershipReceived: numericEnv("SMS_IR_OWNERSHIP_RECEIVED_TEMPLATE_ID"),
          ownershipLost: numericEnv("SMS_IR_OWNERSHIP_LOST_TEMPLATE_ID"),
        },
      }
    : undefined,
);

// Supabase Storage for images. Server-side only — it holds the service-role key,
// so it must never be imported by client components. `SUPABASE_URL` falls back to
// the public URL since they're the same origin.
export const imageStorageRepository: IImageStorageRepository = new SupabaseImageStorageRepository({
  url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  serviceRoleKey: process.env.SUPABASE_SECRET_KEY ?? "",
  bucket: process.env.SUPABASE_IMAGES_BUCKET ?? "images",
});
