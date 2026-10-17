/**
 * Commit messages follow Conventional Commits (`feat: …`, `fix(orders): …`,
 * `chore(deps): …`), checked by the husky `commit-msg` hook. See CHANGELOG.md.
 *
 * @type {import("@commitlint/types").UserConfig}
 */
const config = {
  extends: ["@commitlint/config-conventional"],
};

export default config;
