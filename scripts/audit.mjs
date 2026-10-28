/* eslint-disable no-console -- a CLI report: stdout is its output. */
/**
 * `npm audit` at high/critical severity, minus advisories accepted on purpose.
 *
 * Dev dependencies are audited too: the production image ships the full
 * `node_modules` (the Prisma CLI runs `migrate deploy` at start), so `--omit=dev`
 * would hide packages that really are on the server.
 *
 * An advisory belongs in ACCEPTED only when no fixed version exists and the
 * vulnerable code can't see untrusted input. Each entry says why; drop it once a
 * fix ships (the script reports entries that no longer match anything).
 *
 *   node scripts/audit.mjs
 */
import { execSync } from "node:child_process";

const BLOCKING = new Set(["high", "critical"]);

/** Advisory URL → why it is accepted. */
const ACCEPTED = {};

function runAudit() {
  try {
    return execSync("npm audit --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
    if (typeof error.stdout === "string" && error.stdout.length > 0) return error.stdout;
    throw error;
  }
}

const report = JSON.parse(runAudit());
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    // A string `via` points at another package's entry, which lists the advisory itself.
    if (typeof via === "string" || !BLOCKING.has(via.severity)) continue;
    advisories.set(via.url, { ...via, packageName: vulnerability.name });
  }
}

const blocking = [...advisories.values()].filter((advisory) => !(advisory.url in ACCEPTED));
const accepted = [...advisories.values()].filter((advisory) => advisory.url in ACCEPTED);
const stale = Object.keys(ACCEPTED).filter((url) => !advisories.has(url));

for (const advisory of accepted)
  console.log(`accepted  ${advisory.packageName}: ${ACCEPTED[advisory.url]} (${advisory.url})`);
for (const url of stale) console.log(`stale     ${url} no longer reported; remove it from ACCEPTED`);
for (const advisory of blocking) {
  console.log(
    `${advisory.severity.padEnd(9)} ${advisory.packageName} ${advisory.range}: ${advisory.title} (${advisory.url})`,
  );
}

if (blocking.length > 0) {
  console.log(`\n${blocking.length} high/critical advisory(ies) to fix. Run \`npm audit\` for the dependency paths.`);
  process.exit(1);
}
console.log("\nNo unaccepted high/critical advisories.");
