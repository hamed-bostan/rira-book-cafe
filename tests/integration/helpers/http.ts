import { NextRequest } from "next/server";

/**
 * Build the requests a route handler receives, and read its answers.
 *
 * Handlers are called directly (no server): `await POST(jsonRequest("POST",
 * "/api/products", body))`. That's the whole HTTP contract — status, envelope,
 * headers — without the cost of booting Next for every test; the E2E suite covers
 * the real server.
 */
const ORIGIN = "http://localhost:3000";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function jsonRequest(
  method: Method,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(path, ORIGIN), {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A request whose body is sent exactly as given — for malformed-body cases. */
export function rawRequest(method: Method, path: string, body: string): NextRequest {
  return new NextRequest(new URL(path, ORIGIN), { method, headers: { "content-type": "application/json" }, body });
}

export function getRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return jsonRequest("GET", path, undefined, headers);
}

export function formRequest(path: string, form: FormData): NextRequest {
  return new NextRequest(new URL(path, ORIGIN), { method: "POST", body: form });
}

/** The second argument of a dynamic route's handler. */
export function routeParams<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

/** The standard failure envelope (see `src/lib/api/responses.ts`). */
export type ErrorEnvelope = {
  error: { message: string; code?: string; fieldErrors?: Record<string, string> };
};

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function readError(response: Response): Promise<ErrorEnvelope["error"]> {
  return (await readJson<ErrorEnvelope>(response)).error;
}
