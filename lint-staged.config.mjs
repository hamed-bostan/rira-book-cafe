/**
 * Pre-commit checks on staged files only (run by the husky `pre-commit` hook).
 * ESLint first so its autofixes are then formatted by Prettier.
 *
 * @type {import("lint-staged").Configuration}
 */
const config = {
  "*.{js,mjs,cjs,ts,tsx}": ["eslint --fix --no-warn-ignored", "prettier --write"],
  "*.{json,md,css,yml,yaml}": "prettier --write",
};

export default config;
