---
# base_project:managed
name: updates
description: Report available updates for base_project-managed dependencies, tools, MCPs, and optional catalog entries. Use for $updates or an explicit base_project update inventory request. Read-only: never installs or upgrades.
---

Use `$updates` to report available updates for base_project-managed software. It is distinct
from `$update`: `$update` can update the base_project repository after confirmation; this skill
only reports state and must never change it.

1. Resolve the base_project repository from `~/.base_project/repo-path.txt`. Inspect that
   repository, never the unrelated current project. If unavailable, report `check-failed` for
   affected groups and stop.

2. Default scope covers core packages, installer-managed tools, MCP packages, and optional
   catalog entries with a reliable installed signal. Only literal `all` adds every
   `source/plugins.json` entry. An optional component without a reliable signal is `unknown`,
   not `not-installed`.

3. Derive the inventory from source files rather than a second manifest:
   - root `package.json` and `package-lock.json`: `ajv`, `ajv-formats`, `@biomejs/biome`, `typescript`;
   - installer-managed Node/npm, Git, `gh`, `graphifyy`/`graphify`, `repomix`,
     `@biomejs/biome`, `typescript`, and Unix `jq`;
   - `source/opencode/mcp.json`: `@upstash/context7-mcp`,
     `@modelcontextprotocol/server-filesystem`, `mcp-git`;
   - `source/plugins.json` under the selected scope. Do not represent the historical
     `dev/scripts/check-plugin-updates.js` helper as a complete update checker.

4. Use only bounded, read-only native checks. Continue after independent failures. Interpret
   `npm outdated` exit code 1 with JSON output as updates found, not a failed check.
   - In the resolved repository run `npm outdated --json --all`; run
     `npm outdated --global --json` and filter to managed global npm CLIs.
   - When available, run `uv tool list --outdated`, `pipx list --outdated`, and
     `python -m pip list --outdated --format=json` as a fallback only for pip-installed `graphifyy`.
   - Windows: `winget list --upgrade-available`. macOS:
     `HOMEBREW_NO_AUTO_UPDATE=1 brew outdated --json=v2`. Linux: `apt list --upgradable`.
     Filter each result to managed tools; missing manager is `unsupported`, failed checker is
     `check-failed`.
   - For MCP packages, query `npm view <package> version --json`. An `npx` MCP is
     `floating/latest-on-use` unless a durable local installation is proven.
   - Inspect `.github/dependabot.yml` or `.github/dependabot.yaml` for npm and GitHub Actions
     automation coverage; no config is `unknown`.

5. Reply in the user's language. Use concise groups: `core npm`, `global tools`, `MCPs`,
   `optional catalog`, `automation coverage`. Each row has component, manager/source,
   installed/current, wanted/latest, and exactly one status: `current`, `update-in-range`,
   `major-update`, `floating/latest-on-use`, `not-installed`, `unknown`, `unsupported`, or
   `check-failed`. Include a short error summary for a failed checker.

6. End with counts and concrete manual follow-up commands. Never run `npm install`,
   `npm update`, `npm upgrade`, `uv tool upgrade`, `pip install`, `pipx upgrade`,
   `winget upgrade`, `brew upgrade`, `apt upgrade`, `git pull`, or an installer. Never read
   `.env` values or write manifests, lockfiles, caches, settings, global configuration,
   generated artifacts, credentials, or a persisted report. Applying any update is a separate,
   explicitly authorized task. For later live manual validation, compare repository state,
   manifests, lockfiles, settings, and global tool versions before and after.

Arguments: `$ARGUMENTS`
