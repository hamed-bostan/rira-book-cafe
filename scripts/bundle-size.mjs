/* eslint-disable no-console -- a CLI report: stdout is its output. */
/**
 * First-load JavaScript per page, from a finished `next build` (`.next/`).
 *
 * A page's first load is the framework's root chunks plus every chunk its route
 * segments (root layout → group layouts → page) pull in. Sizes are gzip, which is
 * what a browser actually downloads. The legacy polyfill chunk is left out: it is
 * served `nomodule`, so modern browsers never fetch it.
 *
 *   node scripts/bundle-size.mjs           — print a table, largest first
 *   node scripts/bundle-size.mjs --check   — also fail when a page exceeds its budget
 *   node scripts/bundle-size.mjs --json    — machine-readable, for before/after diffs
 *
 * Budgets live in `bundle-budget.json`: `{ "default": <kB>, "routes": { "<route>": <kB> } }`.
 * A route key is the page's App Router path without the `[locale]` segment and
 * route groups (e.g. `/menu`, `/dashboard/products/[id]/edit`); a key ending in
 * `/*` covers every route under that prefix. The most specific match wins.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const NEXT_DIR = ".next";
const args = new Set(process.argv.slice(2));

/** Every `page_client-reference-manifest.js` under `.next/server/app`. */
function findManifests(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...findManifests(full));
    else if (entry === "page_client-reference-manifest.js") found.push(full);
  }
  return found;
}

/** The manifest file assigns into `globalThis.__RSC_MANIFEST`; evaluate it in isolation. */
function loadManifest(file) {
  const sandbox = { __RSC_MANIFEST: {} };
  new Function("globalThis", "self", readFileSync(file, "utf8"))(sandbox, sandbox);
  const [[key, manifest]] = Object.entries(sandbox.__RSC_MANIFEST);
  return { key, manifest };
}

const gzipCache = new Map();
function gzipBytes(chunk) {
  if (!gzipCache.has(chunk)) gzipCache.set(chunk, gzipSync(readFileSync(path.join(NEXT_DIR, chunk))).length);
  return gzipCache.get(chunk);
}

/** `/[locale]/(main)/menu/page` → `/menu`. */
function routeName(key) {
  const segments = key
    .replace(/\/page$/, "")
    .split("/")
    .filter((s) => s && s !== "[locale]" && !/^\(.*\)$/.test(s));
  return `/${segments.join("/")}`;
}

/** Entry keys that belong to this page: its own segment and every ancestor layout. */
function segmentEntries(key, entryJSFiles) {
  const dir = key.replace(/\/page$/, "");
  return Object.entries(entryJSFiles).filter(([entry]) => {
    const segment = entry.replace(/^\[project\]\/app/, "");
    if (segment === `${dir}/page`) return true;
    if (!segment.endsWith("/layout")) return false;
    const layoutDir = segment.replace(/\/layout$/, "");
    return layoutDir === "" || dir === layoutDir || dir.startsWith(`${layoutDir}/`);
  });
}

const buildManifest = JSON.parse(readFileSync(path.join(NEXT_DIR, "build-manifest.json"), "utf8"));
const rootChunks = buildManifest.rootMainFiles;

const rows = findManifests(path.join(NEXT_DIR, "server", "app"))
  .map(loadManifest)
  .filter(({ key }) => !key.startsWith("/_"))
  .map(({ key, manifest }) => {
    const chunks = new Set(rootChunks);
    for (const [, files] of segmentEntries(key, manifest.entryJSFiles ?? {})) {
      for (const file of files) if (file.endsWith(".js")) chunks.add(file.replace(/^\/_next\//, ""));
    }
    const bytes = [...chunks].reduce((sum, chunk) => sum + gzipBytes(chunk), 0);
    return { route: routeName(key), kB: Math.round(bytes / 102.4) / 10 };
  })
  .sort((a, b) => b.kB - a.kB);

if (args.has("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const width = Math.max(...rows.map((r) => r.route.length));
  console.log(`${"Route".padEnd(width)}  First-load JS (gzip)`);
  for (const { route, kB } of rows) console.log(`${route.padEnd(width)}  ${kB.toFixed(1).padStart(7)} kB`);
}

/** A route's budget: its exact key, else the longest matching `/prefix/*` key, else the default. */
function budgetFor(route, budget) {
  const routes = budget.routes ?? {};
  if (route in routes) return routes[route];
  const prefix = Object.keys(routes)
    .filter((key) => key.endsWith("/*") && (route === key.slice(0, -2) || route.startsWith(key.slice(0, -1))))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? routes[prefix] : budget.default;
}

if (args.has("--check")) {
  const budget = JSON.parse(readFileSync("bundle-budget.json", "utf8"));
  const over = rows.filter(({ route, kB }) => kB > budgetFor(route, budget));
  if (over.length) {
    console.error("\nOver budget (bundle-budget.json):");
    for (const { route, kB } of over) console.error(`  ${route}: ${kB} kB > ${budgetFor(route, budget)} kB`);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} pages within budget.`);
}
