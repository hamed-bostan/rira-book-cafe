import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

import { normalizeAxiosError } from "./normalizeAxiosError";
import { parseApiResponse } from "./parseApiResponse";

import type { ZodType } from "zod";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Shared Axios instance for talking to the app's REST API.
 *
 * `baseURL` is env-driven so the same client can hit this app's own `/api` routes
 * today, or a fully separate backend host later — the UI never changes.
 * `withCredentials` sends the Auth.js session cookie, which is how the protected
 * (admin) endpoints authenticate the caller.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

/**
 * Request interceptor: forward the active locale as `Accept-Language` so the API can
 * serve localized catalog content — the BFF's language negotiation, mirroring the
 * server client. The active locale is read from the document's `lang` (set by the root
 * layout), which stays current across the switcher's full re-navigation.
 */
apiClient.interceptors.request.use((config) => {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  if (lang) config.headers.set("Accept-Language", lang);
  return config;
});

/**
 * Response interceptor: pass successful responses straight through, and normalize
 * every failure into an `ApiError` so callers catch one predictable type and
 * never reach into Axios internals.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normalizeAxiosError(error)),
);

/**
 * Validated request helpers — what the typed services call instead of reaching for
 * `apiClient` directly.
 *
 * Pass the schema of the body you expect and the response is checked against it
 * before the caller sees it, so a malformed or drifted body rejects with an
 * `ApiError` (`EBADRESPONSE`) rather than being cast to `T` on faith. Omit the
 * schema on a mutation whose body the caller ignores: nothing is parsed, and the
 * call resolves with `void`.
 */
export async function apiGet<T>(path: string, schema: ZodType<T>, config?: AxiosRequestConfig): Promise<T> {
  const { data, status } = await apiClient.get<unknown>(path, config);
  return parseApiResponse(schema, data, status);
}

export function apiPost<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
export function apiPost(path: string, body?: unknown): Promise<void>;
export async function apiPost<T>(path: string, body?: unknown, schema?: ZodType<T>): Promise<T | void> {
  const { data, status } = await apiClient.post<unknown>(path, body);
  if (schema) return parseApiResponse(schema, data, status);
}

export function apiPut<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
export function apiPut(path: string, body?: unknown): Promise<void>;
export async function apiPut<T>(path: string, body?: unknown, schema?: ZodType<T>): Promise<T | void> {
  const { data, status } = await apiClient.put<unknown>(path, body);
  if (schema) return parseApiResponse(schema, data, status);
}

export function apiPatch<T>(path: string, body: unknown, schema: ZodType<T>): Promise<T>;
export function apiPatch(path: string, body?: unknown): Promise<void>;
export async function apiPatch<T>(path: string, body?: unknown, schema?: ZodType<T>): Promise<T | void> {
  const { data, status } = await apiClient.patch<unknown>(path, body);
  if (schema) return parseApiResponse(schema, data, status);
}

/** DELETE a resource. Endpoints answer `204 No Content`, so there's no body to validate. */
export async function apiDelete(path: string): Promise<void> {
  await apiClient.delete(path);
}
