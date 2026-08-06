---
description: Run vulnerability scan and security checks.
---

Execute a full security audit on the project:

1. Check for known vulnerabilities in dependencies:
   - JavaScript: `npm audit`
   - Python: `pip-audit`

2. Scan for exposed secrets using `gitleaks` or `trufflehog`.

3. Report findings: critical vulnerabilities, leaked credentials, outdated packages.

$ARGUMENTS