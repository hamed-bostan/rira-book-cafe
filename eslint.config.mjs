import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

// Physical-direction Tailwind classes — banned in favor of logical (RTL-aware)
// equivalents, since the app supports Persian (fa) as well as English.
const PHYSICAL_PROPERTY_MESSAGE =
  "Use the logical equivalent instead of a physical-direction class (ml- → ms-, mr- → me-, pl- → ps-, pr- → pe-, left- → start-, right- → end-, text-left → text-start, text-right → text-end) — this app renders RTL for the fa locale.";
const PHYSICAL_PROPERTY_REGEX = "\\b(ml|mr|pl|pr|left|right)-|\\btext-(left|right)\\b";

// Raw color values — banned in favor of design-system `--color-*` tokens
// (`src/presentation/design-system/tokens/`), so themes/dark-mode stay centralized.
const RAW_COLOR_MESSAGE =
  "Don't use a literal color (hex, rgb()/rgba(), or a raw white/black/gray-scale utility class) — add or reuse a design-system color token instead.";
const RAW_COLOR_REGEX =
  "#[0-9a-fA-F]{3,8}\\b|rgba?\\(|\\b(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|decoration|caret|divide|accent)-(?:white|black|gray-\\d+|slate-\\d+|zinc-\\d+|neutral-\\d+|stone-\\d+)\\b";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code session state — worktrees carry a full repo copy (incl. its own
    // .next build output), which otherwise floods lint with generated-code errors.
    ".claude/**",
  ]),

  // Type-aware TypeScript linting (catches floating promises, unsafe `any` flow,
  // unnecessary conditions, etc. — plain `@typescript-eslint/recommended` is
  // syntax-only and misses all of that).
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [...tseslint.configs.recommendedTypeChecked],
    rules: {
      // Codebase intentionally has zero `any` (see CLAUDE.md "no `any`") —
      // keep it that way instead of only warning.
      "@typescript-eslint/no-explicit-any": "error",
      // Prefer `import type { X }` so type-only imports are erased and don't
      // create accidental runtime dependencies across the domain boundary.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // NOT `prefer-nullish-coalescing`: this codebase leans on `||` on purpose
      // in many places (`trim() || fallback` to also catch empty strings,
      // `Number(x) || default` to also catch NaN, boolean props like
      // `disabled || loading`) — blindly swapping to `??` silently changes
      // behavior for exactly those falsy-but-not-nullish values, which is why
      // the rule's own autofixer refuses to touch most of them.
      "@typescript-eslint/prefer-optional-chain": "error",
      // A rejected promise passed where a sync callback is expected (event
      // handlers, useEffect) silently swallows the error — real bug class.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        // React event handlers (onClick={async () => ...}) are a common,
        // intentional pattern — don't fight it.
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      // A `Promise`-returning method that satisfies a synchronous interface
      // slot (mock/logging adapters implementing an async repository port, a
      // no-op notifier) is a deliberate, common Clean-Architecture pattern
      // here — not a bug. `no-floating-promises`/`no-misused-promises` above
      // already cover the actual danger (a dropped rejection).
      "@typescript-eslint/require-await": "off",
    },
  },

  // Test files mock repository/service ports with `vi.fn()`, which the
  // type-aware rules above can't see through: every mock method is typed
  // loosely (or as a bare function reference passed to `expect(...)`), so
  // `no-unsafe-*` and `unbound-method` fire on idiomatic Vitest code rather
  // than real bugs. Relax type-aware strictness for tests only — production
  // code keeps the full rule set.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },

  {
    rules: {
      // Import hygiene shared by both JS and TS files (the `import` plugin is
      // already registered by eslint-config-next).
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",
      "import/no-anonymous-default-export": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
    },
  },

  // --- Clean Architecture boundaries (CLAUDE.md § Architecture) ---
  // `domain` is framework-free: it must never import outward, from
  // `infrastructure`, `presentation`, `app`, or Next.js itself.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/infrastructure/**", "**/presentation/**", "next", "next/**"],
              message:
                "src/domain is framework-free (CLAUDE.md) — it cannot depend on infrastructure, presentation, or Next.js.",
            },
          ],
        },
      ],
    },
  },
  // The BFF's two halves stay independently deployable: route handlers never
  // reach into presentation-layer UI code.
  {
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/presentation/**"],
              message:
                "app/api must never import from src/presentation (CLAUDE.md) — route handlers stay independently deployable from the frontend.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/presentation/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${PHYSICAL_PROPERTY_REGEX}/]`,
          message: PHYSICAL_PROPERTY_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${PHYSICAL_PROPERTY_REGEX}/]`,
          message: PHYSICAL_PROPERTY_MESSAGE,
        },
        {
          selector: `Literal[value=/${RAW_COLOR_REGEX}/]`,
          message: RAW_COLOR_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${RAW_COLOR_REGEX}/]`,
          message: RAW_COLOR_MESSAGE,
        },
      ],
    },
  },
]);

export default eslintConfig;
