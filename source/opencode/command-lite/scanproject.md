---
# base_project:managed
description: Audit the project against base_project's standards checklist (lite). Read-only — reports findings, never edits files.
---

Audit the current project against the base_project standards checklist and report what's missing or wrong. Read-only — never edit files in this command.

STEP 1 — Read `~/.config/opencode/base_project/references/project-standards.md` — the shared checklist: identity, version control, secrets, dependencies, tests, lint/typecheck, CI, basic security, structure.

STEP 2 — Check each section for real, don't assume from the stack alone:
- Read `.gitignore`. Check `git status`/`git log` for secrets ever committed.
- Look for a manifest + lockfile, a test command, lint/typecheck config.
- Look for a CI pipeline file and read what it actually runs.
- Run the project's own lint/typecheck/test commands if they exist. Read the real output.
- For dangerous code patterns (unsanitized `eval`, remote-exec pipes, obfuscated strings, zero-width Unicode): run `node ~/.config/opencode/base_project/scripts/scan-skill.js .`. If the script is missing, grep manually for `eval(`, `child_process` exec with string interpolation, and `curl | sh` patterns.
- `/audit` goes deeper on security (gitleaks/trufflehog/strix, outdated packages) — mention it as a follow-up, this pass is a quick check only.
- For structure: when `graphify-out/GRAPH_REPORT.md` exists, read its Knowledge Gaps section (isolated nodes, thin communities) and cite the specific ones named there instead of eyeballing the tree; check its Graph Freshness section too — if `built_at_commit` doesn't match `git rev-parse HEAD`, suggest `/bootstrap` first. An isolated node is a signal to verify, not proof — convention/reflection-based wiring won't show as a graph edge. Falls back to manual tree inspection when `graphify-out/` is absent.

STEP 3 — Score each item `ok` / `missing` / `broken`, with severity `critical` / `medium` / `low`, and file/line when applicable.

STEP 4 — Also check the unified `~/.agents/` health:
- Broken symlinks/hardlinks (Cursor `~/.cursor/rules/*.mdc` hardlink inode check; warn on `EXDEV` fallback copy).
- Missing canonical dirs (`~/.agents/rules/global`, `mcp`, `skills`, `commands`).
- Stale hooks in `~/.claude/settings.json` containing `dashboard/`.
- Legacy formats (`.cursorrules` → `.cursor/rules/`).
- Sync drift for `~/.agents/` if it's a git repo (`git status --porcelain` in canonical) — suggest `node dev/scripts/sync.js push`.
Run `node dev/scripts/doctor.js --project . --json` and `node dev/scripts/drift.js --project . --json` for evidence. Only `drift` is repairable; `missing` means never adopted, and `not_applicable` means a self-host projection is deliberately disabled — never suggest `apply --fix` for either one.

STEP 5 — Order the report by severity, critical first. For each finding: what's wrong, and the exact evidence (the command run, the line read).

STEP 6 — End with one line: total critical/medium/low findings, and whether `/fixproject` makes sense next.

STEP 7 — Do not fix anything in this command, even a trivial one-line fix.

$ARGUMENTS
