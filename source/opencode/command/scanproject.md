---
# base_project:managed
description: Rigorously audit an existing (partial or complete) project against base_project's project-standards checklist. Read-only — reports findings, never edits files.
---

Audit the current project against the base_project standards checklist and report what's
missing or wrong. Read-only, same contract as `@architect` and `@reviewer`'s audit mode —
never edit files in this command.

1. Read `~/.config/opencode/base_project/references/project-standards.md` — the shared
   checklist (identity, version control, secrets, dependencies, tests, lint/typecheck,
   CI, basic security, structure).

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

3. Score each checklist item as `ok` / `missing` / `broken`, with severity (`critical` /
   `medium` / `low`) and file/line when applicable — same shape `@reviewer` already uses
   for code review findings, not a new report format.

4. Order the report by severity, critical first. For each finding, state concretely what
   is wrong and what evidence supports it (the command you ran, the line you read) — not
   a vague impression.

5. End with one line: how many critical/medium/low findings total, and whether running
   `/fixproject` next makes sense (it does if there's anything actionable; say so plainly
   if the project is already clean).

6. Do not fix anything in this command, even trivial one-line fixes — that's
   `/fixproject`'s job, kept separate so a scan is always safe to run and its findings
   are trustworthy before anything acts on them.

$ARGUMENTS
