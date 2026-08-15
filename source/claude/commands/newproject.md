---
# base_project:managed
description: Plan the structure and starting checklist for a brand-new project. Read-only — produces a plan, never scaffolds files on its own.
---

Help the user start a new project on the right footing.

1. Ask (briefly, one round of questions, not an interview) what's missing to plan: the
   stack/language, the kind of project (CLI, web app, library, script), and whether this
   is a fresh empty folder or an existing-but-early repo. Skip any question already
   answered by what's in the current directory.

2. Read `~/.claude/base_project/references/project-standards.md` — this is the shared
   checklist of what a well-formed project looks like (identity, version control,
   secrets, dependencies, tests, lint/typecheck, CI, basic security, structure). Use it
   as the shape of the plan, not a script to read aloud.

3. Produce a concrete starting plan tailored to the stack/kind given: which files to
   create first (README, .gitignore, manifest, entry point), what test runner and
   lint/format tooling fits this stack, and a short punch list ordered by what unblocks
   the next step (e.g. git init before .gitignore makes sense, manifest before
   installing anything).

4. Mention relevant base_project plugins from `~/.claude/base_project/plugins.json` only
   if `recommend_if` clearly matches what the user described (e.g. they said "web app
   with a database" → mention the relevant MCP) — do not dump the whole catalog.

5. This command is read-only like `architect`: output the plan, do not create files or
   run scaffolding commands yourself. If the user wants the plan executed, that's a
   separate, explicit follow-up (they can ask directly, or say so and you proceed as a
   normal implementation task — just don't do it silently as part of this command).

6. After presenting the plan, dispatch `/newgoal`'s research as a background task (do not wait
   on it, do not narrate its progress) — pass it what step 1 already established, so it never
   re-asks. It writes `GOALS.md` at the project root: a deep, single-session 0-to-100% build
   plan across backend/frontend/connectivity/database/deployment/etc., meant as input for a
   future `/buildproject` command. Backgrounding this exists specifically to save the tokens a
   fully-narrated research pass would cost here — say one short line that it's running, then
   nothing more about it until it finishes, at which point report only the file path.

7. Report only: the plan (ordered, concrete), which plugins (if any) were mentioned and why,
   and the one-line note that `GOALS.md` research started in the background.

$ARGUMENTS
