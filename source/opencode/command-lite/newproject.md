---
# base_project:managed
description: Plan the structure and starting checklist for a brand-new project (lite). Read-only — produces a plan, never scaffolds files.
---

Help the user start a new project on the right footing.

STEP 1 — Ask one brief round of questions for whatever's missing: stack/language, kind of project (CLI, web app, library, script), and whether this is an empty folder or an existing-but-early repo. Skip anything already obvious from the current directory.

STEP 2 — Read `~/.config/opencode/base_project/references/project-standards.md` — the shared checklist of what a well-formed project looks like. Use it as the shape of the plan, not a script to read aloud.

STEP 3 — Produce a concrete starting plan for the given stack/kind: which files to create first (README, .gitignore, manifest, entry point), which test runner and lint/format tooling fits, and a short punch list ordered by what unblocks the next step.

STEP 4 — Mention a base_project plugin from `~/.config/opencode/base_project/plugins.json` only if its `recommend_if` clearly matches what the user described. Don't dump the whole catalog.

STEP 5 — This command is read-only: output the plan, don't create files or run scaffolding commands. If the user wants it executed, that's a separate follow-up.

STEP 6 — After presenting the plan, start `/newgoal`'s research as a real background task if this session supports backgrounding, carrying `/newgoal`'s own instructions with what step 1 already established (stack, kind, starting state) filled in so it never re-asks. If backgrounding isn't available, say so plainly instead of running it inline. Say one short line that it's running, then report only the file path once it finishes.

STEP 7 — Report: the plan, which plugins (if any) were mentioned and why, and the one-line note that `GOALS.md` research started in the background.

$ARGUMENTS
