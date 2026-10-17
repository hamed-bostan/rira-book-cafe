/**
 * Prettier — formatting only; ESLint owns code-quality rules. Matches the
 * codebase's existing style (120 columns, double quotes, semicolons, trailing
 * commas). Tailwind classes are sorted in the canonical order, including inside
 * `cn()` / `cva()` / `clsx()` calls.
 *
 * @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions}
 */
const config = {
  printWidth: 120,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  // Keep each checkout's line endings: core.autocrlf gives CRLF on Windows, the
  // index (and Linux/CI) stays LF.
  endOfLine: "auto",
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4: the plugin reads the theme (incl. design-system tokens) from the CSS entry.
  tailwindStylesheet: "./src/styles/globals.css",
  tailwindFunctions: ["cn", "cva", "clsx", "twMerge"],
};

export default config;
