---
# base_project:managed
name: scanproject
description: Read-only audit of an existing project against base_project standards. Use when the user invokes $scanproject or asks for a broad project health scan without fixes.
---

Audit the current project rigorously and do not edit anything.

1. Read `~/.codex/base_project/references/project-standards.md` in full.
2. Inspect repository identity, version control, secrets hygiene, dependency manifests and lockfiles, test coverage, lint/typecheck/formatting, CI, baseline security, and organization. Apply only checks relevant to the project's actual stack.
3. If `graphify-out/` is absent, explain that `$bootstrap` produces the preferred map. Continue with targeted reads if the repository is still small enough; never scan dependency or vendored trees wholesale.
4. If `dev/scripts/doctor.js` exists in the base_project repository recorded at `~/.base_project/repo-path.txt`, run it for the current project and treat its output as evidence, not as the entire audit.
5. Run `node <base_project-repo>/dev/scripts/drift.js --project . --json` when available. Report only entries whose status is `drift`; `missing` means a layer was never adopted, and `not_applicable` means a protected self-host projection, never something to repair.
6. If a local skill or instruction bundle is in scope and `~/.claude/base_project/scripts/scan-skill.js` exists, run its advisory trust scan. Never present it as a complete security audit.
7. Report findings by severity with evidence, location, consequence, and an actionable fix. Separate “not applicable” from “not checked.”

Do not create a report file unless the user asks. Do not fix findings; `$fixproject` is the execution counterpart.
