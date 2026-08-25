---
# base_project:managed
description: Security audit and config-layer audit (lite). Two modes in one command.
---

Two modes: security scan, or config-layer visibility.

STEP 1 — If called with `--project`/`--agent` flags, use config-layer mode:
1. Resolve the canonical home via `dev/scripts/paths.js`.
2. Run `node dev/scripts/audit.js --project <cwd> --agent <agent> --json`. Valid agent values: `claude-code`, `cursor`, `codex`, `opencode`, `gemini-cli`, `continue`, `windsurf`, `roo-code`, `cline`, or another breadth-tier id. If no agent given, ask one short question.
3. Show a table: `source | files` (global → agent → project), from `dev/scripts/resolve-layers.js`.
4. With `--json`, match this shape: `{ agent, project, layers: [{source, files}], effectiveConfig: { mcp, skills, instructions } }`.

STEP 2 — If called without `--agent`, use security-scan mode:
1. If `strix` is installed (`strix --version` succeeds), use it as the primary scanner. Otherwise pick by manifest:
   - `package.json` → `npm audit` / `npm outdated`
   - `requirements.txt`/`pyproject.toml` → `pip-audit` / `pip list --outdated`
   - `go.mod` → `govulncheck` / `go list -u -m all`
   - `Cargo.toml` → `cargo audit` / `cargo outdated`
   - `Gemfile` → `bundle audit` / `bundle outdated`
   - Multiple manifests present → run every applicable tool.
   - No tool available → say so plainly and name what to install.
2. Scan for exposed secrets with `gitleaks` or `trufflehog`.
3. Report: critical vulnerabilities, leaked credentials, outdated packages.
4. If `strix` isn't installed and the project handles auth/payments/user data, mention it's available via `/plugins`.

STEP 3 — `audit --help` works in both modes.
