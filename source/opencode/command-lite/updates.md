---
# base_project:managed
description: Report available updates for base_project-managed dependencies and tools, without changing anything (lite).
---

Report updates only. `/updates` is not `/update`: `/update` can update base_project after
confirmation; `/updates` never installs, upgrades, pulls, or edits files.

STEP 1 — Read `~/.base_project/repo-path.txt`. Inspect only that base_project repository, never
the unrelated current project. If it is missing or invalid, report `check-failed` and stop.

STEP 2 — Build the inventory from its source files:
- root `package.json` and `package-lock.json`: `ajv`, `ajv-formats`, `@biomejs/biome`, `typescript`;
- installer-managed Node/npm, Git, `gh`, `graphifyy`/`graphify`, `repomix`, `@biomejs/biome`,
  `typescript`, Unix `jq`;
- `source/opencode/mcp.json`: `@upstash/context7-mcp`, `@modelcontextprotocol/server-filesystem`, `mcp-git`;
- `source/plugins.json`: only entries with a reliable installed signal by default. Literal `all`
  includes every catalog entry; otherwise unknown optional entries are `unknown`, not `not-installed`.
Do not treat `dev/scripts/check-plugin-updates.js` as a complete dependency update checker.

STEP 3 — Run only these bounded read-only checks. An `npm outdated` exit code 1 with JSON is
update data, not a failure.
- In the resolved repo: `npm outdated --json --all`; then `npm outdated --global --json`, filtered
  to managed npm CLIs.
- If available: `uv tool list --outdated`, `pipx list --outdated`, and
  `python -m pip list --outdated --format=json` only as a fallback for pip-installed `graphifyy`.
- Windows: `winget list --upgrade-available`. macOS:
  `HOMEBREW_NO_AUTO_UPDATE=1 brew outdated --json=v2`. Linux: `apt list --upgradable`.
  Filter each to managed tools. Missing checker = `unsupported`; failed available checker = `check-failed`.
- MCP registry metadata: `npm view <package> version --json`. An `npx` MCP is
  `floating/latest-on-use` unless a durable installation is proven.
- Read `.github/dependabot.yml` or `.github/dependabot.yaml` for npm and GitHub Actions coverage;
  absence = `unknown`.

STEP 4 — Reply in the user's language. Group rows as `core npm`, `global tools`, `MCPs`,
`optional catalog`, `automation coverage`. Show component, manager/source, installed/current,
wanted/latest, and one status: `current`, `update-in-range`, `major-update`,
`floating/latest-on-use`, `not-installed`, `unknown`, `unsupported`, or `check-failed`.

STEP 5 — End with counts and concrete manual follow-up commands. Never run `npm install`,
`npm update`, `npm upgrade`, `uv tool upgrade`, `pip install`, `pipx upgrade`, `winget upgrade`,
`brew upgrade`, `apt upgrade`, `git pull`, or an installer. Never read `.env` values or write
manifests, lockfiles, caches, settings, global configuration, generated artifacts, credentials,
or a persisted report. A real update requires a separate explicit authorization. For later live
manual validation, compare repository state, manifests, lockfiles, settings, and global tool
versions before and after.

$ARGUMENTS
