---
# base_project:managed
description: Run a vulnerability scan and security checks (lite).
---

Run a full security audit on the current project.

STEP 1 — If `strix` is installed (`strix --version` succeeds), use it as the primary scanner. Otherwise pick by manifest:
- `package.json` → `npm audit` / `npm outdated`
- `requirements.txt`/`pyproject.toml` → `pip-audit` / `pip list --outdated`
- `go.mod` → `govulncheck` / `go list -u -m all`
- `Cargo.toml` → `cargo audit` / `cargo outdated`
- `Gemfile` → `bundle audit` / `bundle outdated`
- Multiple manifests present → run every applicable tool.
- No tool available → say so plainly and name what to install.

STEP 2 — Scan for exposed secrets with `gitleaks` or `trufflehog`.

STEP 3 — Report: critical vulnerabilities, leaked credentials, outdated packages.

STEP 4 — If `strix` isn't installed and the project handles auth/payments/user data, mention it's available via `/plugins`.

$ARGUMENTS
