@AGENTS.md

# Rira Book Cafe

## Mission

Production-grade cafe & bookshop app with a full admin dashboard. Clean Architecture, design system, best practices.

---

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Radix UI · Prisma + PostgreSQL · self-hosted image storage on disk · Auth.js v5 · React Hook Form + Zod · Swiper · Leaflet

---

## Rules

### Naming

- **Components**: `PascalCase` (`ProductCard.tsx`)
- **Hooks**: `useXxx` (`useCart.ts`)
- **Utils/Types**: `camelCase` / `PascalCase` (`formatPrice.ts`, `Product`)
- **Constants**: `UPPER_SNAKE_CASE` (`MAX_CART_ITEMS`)
- **Folders**: `kebab-case` (`product-card/`)

### TypeScript

- Strict mode, no `any`
- Default to `type` for app code — entities, repository ports, unions, props. Reserve `interface` for declaration merging only: module/global augmentation (e.g. `src/types/*.d.ts` augmenting NextAuth's `Session`), and extending external library/DOM types where `extends` ergonomics genuinely help (e.g. design-system props extending React HTML attributes)
- All functions and components explicitly typed

### Architecture

- Clean Architecture — dependencies point inward: `domain` (entities, use-cases, repository ports) is framework-free; `infrastructure` and `presentation` depend on it, never the reverse
- A schema used by **both** the route handler and the client form is a shared contract: it lives in `src/contracts/`, never inside one of its two consumers. `app/api/**` must never import from `src/presentation/**` — the BFF's two halves stay independently deployable. Schemas only the frontend uses (`*-response-schema.ts` describing what an endpoint returns) stay colocated with their feature
- `infrastructure/container.ts` is the sole composition root: it binds repository interfaces to concrete impls (Prisma / local disk / mocks). Everything else depends on the interfaces
- Server Components default, `"use client"` only when needed
- No business logic in components — REST route handlers (`app/api/<resource>/route.ts`) are thin controllers: authenticate → validate (Zod) → delegate to a use-case → map domain errors to HTTP. Components never call use-cases or the DB directly; they talk to the API through a typed Axios service

### API & Data Fetching

The frontend treats the backend as a separate service: it communicates over HTTP REST (no direct in-process use-case calls from client code). The foundation (auth, dashboard shell, `/api/admin/me` → `viewerServerApi`) is the reference until the first feature lands; freshdrop's Categories feature is the pattern to copy.

- **Full decoupling (BFF)** — the frontend never reads the data layer directly; it always goes over HTTP REST. Browser code uses the client Axios instance; Server Components use the server-side client, so even server renders behave like calls to a separate backend
- **Browser Axios client** — one shared instance in `src/lib/api/client.ts` (`baseURL` from `NEXT_PUBLIC_API_BASE_URL`, falling back to `/api`; `withCredentials` so the Auth.js session cookie is sent). A response interceptor normalizes every failure into an `ApiError` (`src/lib/api/ApiError.ts`) carrying `status`, optional `code`, and per-field `fieldErrors`
- **Server-side client** — `src/lib/api/server-client.ts` (`serverApiGet`) for Server Components: resolves an absolute base URL (`API_BASE_URL`, else derived from request headers) and forwards the request cookies. Server-only (imports `next/headers`). Failure normalization is shared with the browser client via `src/lib/api/normalizeAxiosError.ts`
- **Typed services** — per-feature wrappers around the endpoints; components call those, never Axios directly, and use `async/await`. Browser: e.g. `presentation/dashboard/categories/category-api.ts`. Server: e.g. `presentation/category/category-server-api.ts`
  - **Naming** — file `<entity-singular>-[server-]api.ts`; the exported object is the **plural** entity + suffix: `productsServerApi`, `categoriesApi` (never singular `productServerApi`). Method verbs by return shape: `list…` for collections (`list`, `listFeatured`, `listByCategory`), `get…` for a single record returning the entity or `null` (`getById`, `getBySlug`), `is…` for boolean predicates (`isFavorite`); mutations `create`/`update`/`remove` for entities, `add`/`remove` for join toggles (favorites)
- **Route handlers** return one consistent envelope: the resource (or `204`) on success, `{ error: { message, code?, fieldErrors? } }` on failure. Server helpers live in `src/lib/api/responses.ts`. Status codes: `400` validation, `401` unauthorized, `404` not found, `409` conflict, `5xx` server
- **Auth** — public reads (`GET`); writes (`POST`/`PUT`/`DELETE`) require admin via `getAdminSession`. Re-validate with the _same_ Zod schema the client form uses — never trust the client
- **Reads** — a Server Component fetches over the BFF (server-side service, e.g. `categoriesServerApi`/`favoritesServerApi`) during render and passes plain data into a **presentational** screen. The screen holds no data state — only ephemeral UI state (e.g. a selected filter tab). No first-paint spinner, no client fetch waterfall; the **server is the single source of truth** (see favorites `page.tsx` → `FavoritesScreen`, and dashboard `page.tsx` → `CategoriesScreen`)
- **Mutations** — a client component calls the browser Axios service (e.g. `categoriesApi.remove`), then `router.refresh()` re-runs the server render so the list reflects the change. Never patch a local client copy of the data (no `useState` list + manual splice). A create/update navigates with the router
- **Fetch failures** — a failed server fetch surfaces through a route `error.tsx` boundary whose `reset()` retries the segment — not a hand-rolled retry on a client fetch
- **When to add a client query cache** — only when a screen's interactivity genuinely outgrows a server round-trip per mutation (optimistic updates, instant cross-component cache sync). Then introduce TanStack Query seeded from the RSC data; don't reach for it by default

### File Structure

```
src/
├── domain/          # Entities, use-cases, repository ports (interfaces), errors — no framework imports
├── contracts/       # Zod schemas shared by BOTH sides of the BFF (route handlers + client forms)
├── infrastructure/  # Adapter impls: Prisma + mock repos, disk image storage, prisma client, container.ts
├── presentation/    # Feature UI modules + design-system/ (Radix-based)
├── lib/             # Cross-cutting config & helpers (auth, guards, slugify)
├── shared/          # Shared assets
├── styles/          # Global styles
└── types/           # Global types + module augmentation (*.d.ts)
app/                 # Next.js App Router (repo root) — route groups (main)/(protected)/(dev), api/
```

### Styling

- Tailwind v4 only, mobile-first, design tokens

### Other

- Radix UI for all interactive elements
- Errors handled explicitly
- One component per file

---

## Claude Behavior

- **Never run the dev server**
