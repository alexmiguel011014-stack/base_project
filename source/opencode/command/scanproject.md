---
# base_project:managed
description: Rigorously audit an existing (partial or complete) project against base_project's project-standards checklist. Read-only — reports findings, never edits files.
---

Audit the current project against the base_project standards checklist and report what's
missing or wrong. Read-only, same contract as `architect` and `reviewer`'s audit mode —
never edit files in this command.

1. Read `~/.claude/base_project/references/project-standards.md` — the shared checklist
   (identity, version control, secrets, dependencies, tests, lint/typecheck, CI, basic
   security, structure).

2. For each section, actually check the project — don't assume from the stack alone:
   - Read `.gitignore`, check `git status`/`git log` for secrets ever committed.
   - Look for a manifest + lockfile, a test command, lint/typecheck config.
   - Look for a CI pipeline file and what it actually runs.
   - Run the project's own lint/typecheck/test commands if they exist, and read the
     real output — don't infer pass/fail from the file's existence alone.
   - For dangerous code patterns (unsanitized `eval`, remote-exec pipes, obfuscated
     strings, zero-width Unicode): run `node ~/.claude/base_project/scripts/scan-skill.js .`
     directly — it implements the same rules and is already tested. If the script is
     missing, fall back to grepping for `eval(`, `child_process` exec with string
     interpolation, and `curl | sh` patterns manually.
   - Note: `/audit` goes deeper on the security axis (gitleaks/trufflehog/strix for
     secret scanning, outdated packages). §8 here is a quick pass — run `/audit`
     separately if you want the full picture.
   - For §9 (Structure): when `graphify-out/GRAPH_REPORT.md` exists, read its
     `## Knowledge Gaps` section (isolated nodes, thin communities) and cite the specific
     ones named there instead of eyeballing the tree; also check its "Graph Freshness"
     section — if `built_at_commit` doesn't match `git rev-parse HEAD`, note that the
     structural finding may be based on a stale graph and suggest `/bootstrap` first. An
     isolated node is a signal to verify, not proof: convention/reflection-based wiring (DI
     containers, ORM folder auto-discovery, dynamic imports) won't show as a graph edge.
     Falls back to manual tree inspection when `graphify-out/` is absent.

3. Score each checklist item as `ok` / `missing` / `broken`, with severity (`critical` /
   `medium` / `low`) and file/line when applicable — same shape `reviewer` already uses
   for code review findings, not a new report format.

4. **Unified layer health (doctor, now inside scanproject, not a separate command):** after the 9 standard categories, also check the unified `~/.agents/` health — same logic `doctor.js` uses, but reported inline here:
   - Broken symlinks/hardlinks (Cursor `~/.cursor/rules/*.mdc` hardlink inode check; warn on `EXDEV` fallback copy)
   - Missing canonical dirs (`~/.agents/rules/global`, `mcp`, `skills`, `commands`)
   - Stale hooks in `~/.claude/settings.json` containing `dashboard/`
   - Legacy formats (`.cursorrules` → `.cursor/rules/`)
   - `sync` drift for `~/.agents/` if it is a git repo (`git status --porcelain` in canonical) — suggest `node dev/scripts/sync.js push` or `bootstrap` sync
   Run `node dev/scripts/doctor.js --project . --json` and `node dev/scripts/drift.js --project . --json` for real evidence. Only a `drift` status is repairable; `missing` means the layer was never adopted, and `not_applicable` means self-host projection is deliberately disabled — never suggest `apply --fix` for either one.

5. Order the report by severity, critical first. For each finding, state concretely what
   is wrong and what evidence supports it (the command you ran, the line you read) — not
   a vague impression.

6. End with one line: how many critical/medium/low findings total, and whether running
   `/fixproject` next makes sense (it does if there's anything actionable; say so plainly
   if the project is already clean).

7. Do not fix anything in this command, even trivial one-line fixes — that's
   `/fixproject`'s job, kept separate so a scan is always safe to run and its findings
   are trustworthy before anything acts on them.

$ARGUMENTS
