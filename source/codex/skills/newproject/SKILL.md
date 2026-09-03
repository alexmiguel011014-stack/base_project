---
# base_project:managed
name: newproject
description: Plan a brand-new project's structure and starting checklist without scaffolding files. Use for $newproject or an explicit greenfield planning request.
---

Plan a new project; do not create it.

1. Ask one brief round for only the missing stack/language, project kind, and whether the folder is empty or an early repository.
2. Read `~/.codex/base_project/references/project-standards.md`.
3. Produce a concrete starting plan: identity and README, version control and `.gitignore`, manifest and lockfile, entry point, secrets handling, tests, lint/format/typecheck, CI, security baseline, and an appropriate directory layout. Order by dependency.
4. Read `~/.codex/base_project/plugins.json` and mention only capabilities whose `recommend_if` condition clearly matches. Never install them.
5. Keep this workflow read-only. Scaffolding is a separate request.
6. After presenting the concise starting plan, delegate the `$newgoal` research workflow to a background subagent when the current Codex environment supports it, carrying forward all context so it does not re-ask. If background delegation is unavailable, say so; do not silently run the long research inline.
7. Report the plan, relevant plugin suggestions, and whether background `GOALS.md` research started.

