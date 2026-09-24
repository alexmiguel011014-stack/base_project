---
# base_project:managed
name: scanproject
description: Read-only audit of an existing project against base_project standards. Use when the user invokes $scanproject or asks for a broad project health scan without fixes.
---

Audit the current project rigorously and do not edit anything.

1. Read `~/.codex/base_project/references/project-standards.md` in full.
2. Inspect repository identity, version control, secrets hygiene, dependency manifests and lockfiles, test coverage, lint/typecheck/formatting, CI, baseline security, and organization. Apply only checks relevant to the project's actual stack.
3. If `graphify-out/` is absent, explain that `$bootstrap` produces the preferred map. Continue with targeted reads if the repository is still small enough; never scan dependency or vendored trees wholesale.
4. If a local skill or instruction bundle is in scope and `~/.claude/base_project/scripts/scan-skill.js` exists, run its advisory trust scan. Never present it as a complete security audit.
5. Report findings by severity with evidence, location, consequence, and an actionable fix. Separate “not applicable” from “not checked.”

Do not create a report file unless the user asks. Do not fix findings; `$fixproject` is the execution counterpart.
