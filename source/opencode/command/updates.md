---
# base_project:managed
description: Report available updates for base_project-managed dependencies, tools, MCPs, and detected optional catalog entries. Read-only: never installs, upgrades, pulls, or modifies files.
---

Report available updates for base_project-managed software. This is informational only:
`/updates` is distinct from `/update`, which checks and can update the base_project repository
after confirmation. `/updates` never changes a version or configuration.

1. Resolve base_project from `~/.base_project/repo-path.txt`. Inspect that repository only;
   never scan the unrelated current project. If it is absent or invalid, mark affected groups
   `check-failed` and stop.

2. Scope the inventory. Default: core packages, installer-managed tools, MCP packages, and
   optional catalog entries with a reliable installed signal. Literal `all` additionally reports
   every `source/plugins.json` entry. Otherwise an optional component without a signal is
   `unknown`, not `not-installed`.

3. Derive entries from their source of truth, never a duplicate manifest:
   - root `package.json` and `package-lock.json`: `ajv`, `ajv-formats`, `@biomejs/biome`,
     `typescript`;
   - installer-managed Node/npm, Git, `gh`, `graphifyy`/`graphify`, `repomix`,
     `@biomejs/biome`, `typescript`, and Unix `jq`;
   - `source/opencode/mcp.json`: `@upstash/context7-mcp`,
     `@modelcontextprotocol/server-filesystem`, `mcp-git`;
   - `source/plugins.json` under the scope rule. Do not present the historical
     `dev/scripts/check-plugin-updates.js` helper as a complete update checker.

4. Run bounded, read-only checks and continue after unrelated failures. `npm outdated` exit
   code 1 with JSON output means updates were found, not that the check failed.
   - In the resolved repo: `npm outdated --json --all`; then `npm outdated --global --json`,
     filtered to managed global npm CLIs.
   - When available: `uv tool list --outdated`, `pipx list --outdated`, and
     `python -m pip list --outdated --format=json` as a fallback for pip-installed `graphifyy`.
   - Windows: `winget list --upgrade-available`; macOS:
     `HOMEBREW_NO_AUTO_UPDATE=1 brew outdated --json=v2`; Linux: `apt list --upgradable`.
     Filter to managed tools. Missing manager is `unsupported`; a failed available checker is
     `check-failed`.
   - MCP registry metadata: `npm view <package> version --json`. An `npx` MCP is
     `floating/latest-on-use`, not an installed-version comparison unless installation is proven.
   - Inspect `.github/dependabot.yml` or `.github/dependabot.yaml` for npm and GitHub Actions
     automation coverage; absence is `unknown`.

5. Reply in the user's language with concise groups: `core npm`, `global tools`, `MCPs`,
   `optional catalog`, `automation coverage`. Each row shows component, manager/source,
   installed/current, wanted/latest, and exactly one status: `current`, `update-in-range`,
   `major-update`, `floating/latest-on-use`, `not-installed`, `unknown`, `unsupported`, or
   `check-failed`. Explain failed checks briefly and distinguish a compatible update from a
   major update.

6. End with counts and concrete manual follow-up commands only. Never run `npm install`,
   `npm update`, `npm upgrade`, `uv tool upgrade`, `pip install`, `pipx upgrade`,
   `winget upgrade`, `brew upgrade`, `apt upgrade`, `git pull`, or an installer. Never read
   `.env` values or write manifests, lockfiles, caches, settings, global configuration,
   generated artifacts, credentials, or a persisted report. Any update needs separate explicit
   authorization. For later live manual validation, compare repository state, manifests,
   lockfiles, settings, and global tool versions before and after.

$ARGUMENTS
