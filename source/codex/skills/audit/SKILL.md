---
# base_project:managed
name: audit
description: Run either a security-focused project audit or a unified configuration-layer audit. Use for $audit, vulnerability review, or checking which base_project layers apply to an agent.
---

Choose the mode from the invocation arguments. If genuinely unclear, ask one short question.

## Security mode

1. Detect the ecosystem from project manifests and lockfiles.
2. Run the project's native vulnerability tools where available, plus targeted checks for committed secrets, unsafe defaults, exposed debug settings, injection surfaces, and dependency risks.
3. Do not install tools or modify dependency files merely to complete the audit.
4. Report severity, evidence, affected versions or paths, practical exploitability, and remediation. Distinguish confirmed findings from advisories requiring validation.

## Configuration mode

1. Resolve the base_project repository through `~/.base_project/repo-path.txt`.
2. Run `node <repo>/dev/scripts/audit.js --project <cwd> --agent <agent> --json`.
3. Use `codex` when the user asks about this engine. Accept another adapter id only when named.
4. Explain the effective global → agent → project layers, their sources, and any drift or shadowing. Do not apply changes.

