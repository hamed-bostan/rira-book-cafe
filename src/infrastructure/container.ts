import type { IActivityLog } from "@/src/domain/repositories/IActivityLog";
import type { IAuthRepository } from "@/src/domain/repositories/IAuthRepository";
import type { ICategoryRepository } from "@/src/domain/repositories/ICategoryRepository";
import type { IImageStorageRepository } from "@/src/domain/repositories/IImageStorageRepository";
import type { IOrderNoteRepository } from "@/src/domain/repositories/IOrderNoteRepository";
import type { IOrderRepository } from "@/src/domain/repositories/IOrderRepository";
import type { IProductRepository } from "@/src/domain/repositories/IProductRepository";
import type { IUserRepository } from "@/src/domain/repositories/IUserRepository";

import { MockAuthRepository } from "./repositories/mock/MockAuthRepository";
import { PrismaActivityLog } from "./repositories/PrismaActivityLog";
import { PrismaCategoryRepository } from "./repositories/PrismaCategoryRepository";
import { PrismaOrderNoteRepository } from "./repositories/PrismaOrderNoteRepository";
import { PrismaOrderRepository } from "./repositories/PrismaOrderRepository";
import { PrismaProductRepository } from "./repositories/PrismaProductRepository";
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

// Supabase Storage for images. Server-side only — it holds the service-role key,
// so it must never be imported by client components. `SUPABASE_URL` falls back to
// the public URL since they're the same origin.
export const imageStorageRepository: IImageStorageRepository = new SupabaseImageStorageRepository({
  url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  serviceRoleKey: process.env.SUPABASE_SECRET_KEY ?? "",
  bucket: process.env.SUPABASE_IMAGES_BUCKET ?? "images",
});
