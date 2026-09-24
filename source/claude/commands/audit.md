---
# base_project:managed
description: Run vulnerability scan and security checks.
---

Execute a full security audit on the current project:

1. If `strix` is installed (`strix --version` succeeds), use it as the primary scanner — it validates
   findings with working proofs-of-concept instead of a static list. Otherwise fall back based on
   whichever manifest is actually present — don't assume JS/Python, this project itself is
   stack-agnostic elsewhere and `/audit` should be too:
   - JavaScript (`package.json`): `npm audit` for vulnerabilities; `npm outdated` for outdated packages.
   - Python (`requirements.txt`/`pyproject.toml`): `pip-audit` for vulnerabilities; `pip list --outdated`
     for outdated packages.
   - Go (`go.mod`): `govulncheck ./...` for vulnerabilities; `go list -u -m all` for outdated modules.
   - Rust (`Cargo.toml`): `cargo audit` for vulnerabilities; `cargo outdated` for outdated crates (if
     installed — mention it's optional if missing, don't block the scan on it).
   - Ruby (`Gemfile`): `bundle audit check --update` for vulnerabilities; `bundle outdated` for outdated
     gems.
   - More than one manifest present (e.g. a repo with both a `package.json` frontend and a `go.mod`
     backend): run every applicable tool, don't pick just one.
   - None of the above tools available for a detected manifest: say so plainly and name what would need
     to be installed, rather than silently skipping that stack's dependency check.
2. Scan for exposed secrets using `gitleaks` or `trufflehog`.
3. Report findings: critical vulnerabilities, leaked credentials, outdated packages.
4. If `strix` isn't installed and the project handles auth/payments/user data, mention it's available via
   `/plugins`.

$ARGUMENTS
