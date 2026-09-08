---
# base_project:managed
description: Execute the build plan in GOALS.md (lite). Scaffolds, wires, and installs each item in order, checking items off as verified.
---

Execute `GOALS.md` at the project root: turn the plan into a real, working project, one ordered item at a time. Verify each item before checking it off — never assume a change worked just because it was applied.

STEP 1 — Require a plan. If `GOALS.md` doesn't exist, check whether `/newgoal` already ran for a research-type ask in this conversation — that path skips `GOALS.md` and produces a standalone document instead. If so, say that plainly. Otherwise stop and say to run `/newgoal` first. This command executes a plan, it doesn't improvise one.

STEP 2 — Read the whole file first. Present a short summary before touching anything: which areas apply, how many items are `[x]` vs. open, and which open items are heavier or harder to reverse (installing dependencies, initializing a database, `git init`). An explicit `/execgoals` invocation already authorizes auto-approved and notify-and-proceed work; ask only for a human-in-the-loop item.

STEP 3 — Work through unchecked items in the order they're written — don't re-derive an order. For each item:
- **Auto-approved**: trivial, routine, reversible work inside the current repository applies directly.
- **Notify-and-proceed**: a non-trivial but in-scope, reversible item uses the normal plan → implement workflow; state the visible effect, then continue and verify it.
- **Human-in-the-loop**: an irreversible or hard-to-recover action, a material user-only choice, data/state outside the repository, sensitive data, credentials, or external publication stops and asks. Never fabricate a placeholder that looks real. Secrets go in the project's own gitignored `.env`, never hardcoded.

STEP 4 — Check items off only as verified, not as attempted. After completing an item, actually confirm it: the file exists, the test passes, the server starts. Update `GOALS.md` in place (`[ ]` → `[x]`) as you go. After a batch of edits to the same `GOALS.md` within one area, run `node ~/.claude/base_project/scripts/validate-goals-structure.js GOALS.md`; repair any finding and leave the affected item open before continuing.

STEP 4a — Archive a section once every item under it is `[x]`: move its full body to `dev/goals-archive/goals-NN-<slug>.md` (kebab-case from the heading), compute its SHA-256, append a row to `dev/goals-archive/README.md`'s table, and remove the section (and its "Active plans" entry) from the root file. Auto-approved, repo-local, reversible — no separate confirmation needed beyond the run's own authorization. Re-run the structure validator after the move.

STEP 5 — Run the project's own test/lint/typecheck after each area finishes, not only at the end.

STEP 6 — If interrupted or partially done, resuming just works — read the current `[x]`/`[ ]` state and continue from the first open item. Never restart from zero, never redo something already checked off.

STEP 7 — Report: what got built (by area), what's still open and why, and the current `GOALS.md` completion count. Never commit automatically — offer to prepare a commit once there's something worth committing, and wait for confirmation.

$ARGUMENTS
