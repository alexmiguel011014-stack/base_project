---
# base_project:managed
description: Run vulnerability scan and security checks.
---

Execute a full security audit on the current project:

1. If `strix` is installed (`strix --version` succeeds), use it as the primary scanner — it validates
   findings with working proofs-of-concept instead of a static list. Otherwise fall back to:
   - JavaScript: `npm audit` for vulnerabilities; `npm outdated` for outdated packages.
   - Python: `pip-audit` for vulnerabilities; `pip list --outdated` for outdated packages.
2. Scan for exposed secrets using `gitleaks` or `trufflehog`.
3. Report findings: critical vulnerabilities, leaked credentials, outdated packages.
4. If `strix` isn't installed and the project handles auth/payments/user data, mention it's available via
   `/plugins`.

$ARGUMENTS
