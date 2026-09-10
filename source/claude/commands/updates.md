---
# base_project:managed
description: Report available updates for base_project-managed dependencies, tools, MCPs, and detected optional catalog entries. Read-only: never installs, upgrades, pulls, or modifies files.
---

Report available updates for the software base_project manages. This is informational
only: `/updates` is not `/update`. `/update` checks and, after confirmation, updates the
base_project repository itself; `/updates` only reports versions and never changes them.

1. Resolve the base_project repository from `~/.base_project/repo-path.txt`. Do not inspect
   an unrelated current project. If the file or repository is unavailable, report `check-failed`
   for every affected group and stop.

2. Set scope. By default inspect base_project core packages, installer-managed tools, MCP
   packages, and optional catalog entries that have a reliable installed signal. Only the
   literal argument `all` includes every entry in `source/plugins.json`; otherwise optional
   entries without a reliable signal are `unknown`, not `not-installed`.

3. Derive inventory from its owning sources instead of a duplicate manifest:
   - root `package.json` and `package-lock.json`: `ajv`, `ajv-formats`, `@biomejs/biome`,
     and `typescript`;
   - installer-managed runtime/tool names: Node/npm, Git, `gh`, `graphifyy`/`graphify`,
     `repomix`, `@biomejs/biome`, `typescript`, and Unix `jq`;
   - `source/opencode/mcp.json`: `@upstash/context7-mcp`,
     `@modelcontextprotocol/server-filesystem`, and `mcp-git`;
   - `source/plugins.json` only under the scope rule above. The historical
     `dev/scripts/check-plugin-updates.js` helper is not a complete dependency update checker.

4. Use only read-only, bounded native checks; continue independently when one is unavailable.
   Treat `npm outdated` exit code 1 with JSON output as update data, not a failure.
   - In the resolved repository, run `npm outdated --json --all` for core npm packages. Run
     `npm outdated --global --json` and retain only installer-managed global npm CLIs.
   - Where available, run `uv tool list --outdated`, `pipx list --outdated`, and
     `python -m pip list --outdated --format=json`; use the Python result only as a fallback
     to detect `graphifyy` installed through pip.
   - On Windows run `winget list --upgrade-available`; on macOS run
     `HOMEBREW_NO_AUTO_UPDATE=1 brew outdated --json=v2`; on Linux run
     `apt list --upgradable`. Filter each result to the managed tool inventory. If a manager
     is absent, report `unsupported`; if its check errors, report `check-failed`.
   - Query each MCP package with `npm view <package> version --json`. MCPs invoked by `npx`
     are `floating/latest-on-use`: report registry latest, but do not claim an installed-version
     comparison unless a durable local installation is actually detected.
   - Read `.github/dependabot.yml` or `.github/dependabot.yaml` if present and report the
     coverage for npm and GitHub Actions; absence is `unknown`, not a broken update check.

5. Respond in the user's language. Group a concise table as `core npm`, `global tools`,
   `MCPs`, `optional catalog`, and `automation coverage`. Each row includes component,
   manager/source, current or installed version when known, wanted/latest version when known,
   and exactly one status:
   - `current` — the checker found no newer version;
   - `update-in-range` — a newer compatible range/manager update is available;
   - `major-update` — an update crosses the current major version;
   - `floating/latest-on-use` — on-demand package, so no installed comparison is honest;
   - `not-installed` — a reliable local check found no installed component;
   - `unknown` — no reliable installed or automation signal;
   - `unsupported` — the relevant manager is unavailable on this machine;
   - `check-failed` — a supported check could not complete; include a short error summary.

6. End with counts and only concrete manual follow-up commands. Never run or suggest as part
   of this command `npm install`, `npm update`, `npm upgrade`, `uv tool upgrade`, `pip install`,
   `pipx upgrade`, `winget upgrade`, `brew upgrade`, `apt upgrade`, `git pull`, or any installer.
   Never read `.env` values or write manifests, lockfiles, caches, settings, global
   configuration, generated artifacts, credentials, or a persisted report. Applying an update
   requires a separate, explicitly authorized task. For later live manual validation, compare
   repository state, manifests, lockfiles, settings, and global tool versions before and after.

$ARGUMENTS
