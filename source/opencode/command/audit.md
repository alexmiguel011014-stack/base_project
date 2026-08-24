---
# base_project:managed
description: Security audit (vuln scan) + unified-layer config audit (which layers apply to a project+agent).
---

Two modes — security and config visibility — in one command.

**Config audit mode** (new, GOALS 6): when called with `--project`/`--agent` flags, show which unified-layer config applies.

1. Resolve the canonical home via `dev/scripts/paths.js`.
2. Run `node dev/scripts/audit.js --project <cwd> --agent <agent> --json` where `<agent>` is one of `claude-code`, `cursor`, `codex`, `opencode`, `gemini-cli`, `continue`, `windsurf`, `roo-code`, `cline` (or any breadth-tier id). If no agent is specified, ask briefly (one question).
3. Render as a table: `source | files` (global → agent → project). Reuses `dev/scripts/resolve-layers.js`.
4. Output shape must match `dot-agents audit`: `{ agent, project, layers: [{source, files}], effectiveConfig: { mcp, skills, instructions } }` when called with `--json`.

**Security audit mode** (original): when called without `--agent`, run a full vulnerability scan.

1. If `strix` is installed (`strix --version` succeeds), use it as primary scanner. Otherwise fall back by manifest:
   - JavaScript (`package.json`): `npm audit` / `npm outdated`
   - Python (`requirements.txt`/`pyproject.toml`): `pip-audit` / `pip list --outdated`
   - Go (`go.mod`): `govulncheck` / `go list -u -m all`
   - Rust (`Cargo.toml`): `cargo audit` / `cargo outdated`
   - Ruby (`Gemfile`): `bundle audit` / `bundle outdated`
   - Multiple manifests: run every applicable tool.
   - No tool available: say so plainly and name what to install.
2. Scan for exposed secrets using `gitleaks` or `trufflehog`.
3. Report findings: critical vulnerabilities, leaked credentials, outdated packages.
4. If `strix` isn't installed and project handles auth/payments/user data, mention it's available via `/plugins`.

Support `audit --help` for both modes.
