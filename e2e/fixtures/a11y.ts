import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type Violation = AxeResults["violations"][number];

/** Impacts that fail the test; minor and moderate ones are reported only. */
const BLOCKING = new Set(["serious", "critical"]);

function summarize(violations: Violation[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.slice(0, 5).map((node) => `    ${node.target.join(" ")}`);
      return `[${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} node(s))\n${targets.join("\n")}`;
    })
    .join("\n");
}

/**
 * Run axe (WCAG 2.1 A/AA) on the page as it is now. Every violation is attached to
 * the test report; serious and critical ones fail the test.
 */
export async function expectNoSeriousA11yViolations(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  // Audit the settled page: mid fade-in, text is partly transparent and axe would
  // measure its contrast against a colour it never ends up with. Waiting for running
  // animations isn't enough on a slow runner — content that renders after the wait
  // starts fading in during the audit — so every animation and transition is made
  // instant first: running ones jump to their end state, later ones never start.
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }",
  });
  // Looping animations (a spinner) still loop; the rest have settled.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

  if (results.violations.length > 0) {
    await testInfo.attach(`axe-${label}.txt`, { body: summarize(results.violations), contentType: "text/plain" });
  }

  const blocking = results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ""));
  expect(blocking, `Serious/critical accessibility violations on ${label}:\n${summarize(blocking)}`).toEqual([]);
}
