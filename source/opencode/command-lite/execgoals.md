---
# base_project:managed
description: Execute the build plan in GOALS.md (lite). Scaffolds, wires, and installs each item in order, checking items off as verified.
---

Execute `GOALS.md` at the project root: turn the plan into a real, working project, one ordered item at a time. Verify each item before checking it off — never assume a change worked just because it was applied.

 ### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan or safety boundaries.


STEP 1 — Require a plan. If `GOALS.md` doesn't exist, check whether `/newgoal` already ran for a research-type ask in this conversation — that path skips `GOALS.md` and produces a standalone document instead. If so, say that plainly. Otherwise stop and say to run `/newgoal` first. This command executes a plan, it doesn't improvise one.

STEP 2 — Read the whole file first. Present a short summary before touching anything: which areas apply, how many items are `[x]` vs. open, and which open items are heavier or harder to reverse (installing dependencies, initializing a database, `git init`). An explicit `/execgoals` invocation already authorizes auto-approved and notify-and-proceed work; ask only for a human-in-the-loop item.

STEP 2a — Preflight the plan before the first edit. For the items about to run, confirm each `(exists)` path is present and each `Anchor:` still matches verbatim, and run the project's test/lint/typecheck once to record a baseline. If an anchor no longer matches, a `(new)` path already exists, or an item says `(unverified — confirm before executing)`, stop on that item and report it as plan drift: the plan is stale there, and the fix is to update `GOALS.md` (or rerun `/newgoal` for that section), never to improvise a substitute edit. Items before it that passed preflight may still run. A section without the `<!-- item-contract: v1 -->` marker skips the anchor checks but still records the baseline.

STEP 3 — Work through unchecked items in the order they're written — don't re-derive an order. For each item:
- **Auto-approved**: trivial, routine, reversible work inside the current repository applies directly.
- **Notify-and-proceed**: a non-trivial but in-scope, reversible item goes to `coder` with the item's own text as the brief; state the visible effect, then continue and verify it. Run `architect` first only when the item's owner is `architect` or its `Change:` is a specification that still leaves a design question — `/newgoal` already did the design, and repeating it costs tokens and invites a second, different answer.
- **Human-in-the-loop**: an irreversible or hard-to-recover action, a material user-only choice, data/state outside the repository, sensitive data, credentials, or external publication stops and asks. Never fabricate a placeholder that looks real. Secrets go in the project's own gitignored `.env`, never hardcoded.

STEP 3a — CDP mode. If the current `/execgoals` invocation arguments contain a standalone, case-insensitive token `cdp`, `/cdp`, `$cdp`, or `--cdp`, inspect only those arguments for a match; never scan `GOALS.md` or project files. Say once that CDP mode is on for this invocation, read `~/.config/opencode/base_project/references/cdp-verification.md` in full before verifying the first item, and apply it to every item with a browser-reachable UI. Check off such an item only with the CDP evidence that reference defines. For an item without a browser-reachable UI, say `cdp: not applicable` and verify it as usual. Without a matching token, never start a browser with a debug port.

STEP 4 — Check items off only as verified, not as attempted. After completing an item, actually confirm it: the file exists, the test passes, the server starts. Update `GOALS.md` in place (`[ ]` → `[x]`) as you go. After a batch of edits to the same `GOALS.md` within one area, run `node ~/.claude/base_project/scripts/validate-goals-structure.js GOALS.md`; repair any finding and leave the affected item open before continuing. When the item has a `Verify:` line, that check is the proof: run it and compare with its expected result; a mismatch keeps the item open.

STEP 4a — Archive a section once every item under it is `[x]`: move its full body to `dev/goals-archive/goals-NN-<slug>.md` (kebab-case from the heading), compute its SHA-256, append a row to `dev/goals-archive/README.md`'s table, and remove the section (and its "Active plans" entry) from the root file. Auto-approved, repo-local, reversible — no separate confirmation needed beyond the run's own authorization. Re-run the structure validator after the move. If the project's `CLAUDE.md` names a command that writes the archive checksums, run that command instead of computing the checksum by hand, then run its check mode.

STEP 5 — Run the project's own test/lint/typecheck after each area finishes, not only at the end.

STEP 6 — If interrupted or partially done, resuming just works — read the current `[x]`/`[ ]` state and continue from the first open item. Never restart from zero, never redo something already checked off.

STEP 7 — Report: what got built (by area), what's still open and why, and the current `GOALS.md` completion count. Never commit automatically — offer to prepare a commit once there's something worth committing, and wait for confirmation.

$ARGUMENTS
