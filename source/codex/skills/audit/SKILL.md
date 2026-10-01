---
# base_project:managed
name: audit
description: Run a security-focused project audit. Use for $audit or a vulnerability review.
---

1. Detect the ecosystem from project manifests and lockfiles.
2. Run the project's native vulnerability tools where available, plus targeted checks for committed secrets, unsafe defaults, exposed debug settings, injection surfaces, and dependency risks.
3. Do not install tools or modify dependency files merely to complete the audit.
4. Report severity, evidence, affected versions or paths, practical exploitability, and remediation. Distinguish confirmed findings from advisories requiring validation.
