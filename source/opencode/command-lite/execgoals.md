---
# base_project:managed
description: Execute the build plan in GOALS.md (lite). Scaffolds, wires, and installs each item in order, checking items off as verified.
---

Execute `GOALS.md` at the project root: turn the plan into a real, working project, one ordered item at a time. Verify each item before checking it off — never assume a change worked just because it was applied.

STEP 1 — Require a plan. If `GOALS.md` doesn't exist, check whether `/newgoal` already ran for a research-type ask in this conversation — that path skips `GOALS.md` and produces a standalone document instead. If so, say that plainly. Otherwise stop and say to run `/newgoal` first. This command executes a plan, it doesn't improvise one.

STEP 2 — Read the whole file first. Present a short summary before touching anything: which areas apply, how many items are `[x]` vs. open, and which open items are heavier or harder to reverse (installing dependencies, initializing a database, `git init`). Ask for one confirmation to proceed with the whole ordered run.

STEP 3 — Work through unchecked items in the order they're written — don't re-derive an order. For each item:
- Trivial items (create a config file, add a `.gitignore` line) apply directly.
- Non-trivial items: plan first, then implement, same as any real change in this project.
- If an item needs a decision only the user can make (which provider, which region, a real credential), stop and ask — never fabricate a placeholder that looks real. Secrets go in the project's own gitignored `.env`, never hardcoded.

STEP 4 — Check items off only as verified, not as attempted. After completing an item, actually confirm it: the file exists, the test passes, the server starts. Update `GOALS.md` in place (`[ ]` → `[x]`) as you go.

STEP 5 — Run the project's own test/lint/typecheck after each area finishes, not only at the end.

STEP 6 — If interrupted or partially done, resuming just works — read the current `[x]`/`[ ]` state and continue from the first open item. Never restart from zero, never redo something already checked off.

STEP 7 — Report: what got built (by area), what's still open and why, and the current `GOALS.md` completion count. Never commit automatically — offer to prepare a commit once there's something worth committing, and wait for confirmation.

$ARGUMENTS
