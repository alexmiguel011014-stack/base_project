---
# base_project:managed
description: Execute the build plan in GOALS.md — scaffold, wire, and install each item in order, checking items off as they're verified done. The execution counterpart to /newgoal.
---

Execute `GOALS.md` at the project root: turn the plan `/newgoal` researched into a real, working
project, one ordered item at a time — with the same before/after verification discipline as
`/fixproject`, not "apply a patch and assume it worked."

1. **Require a plan.** If `GOALS.md` doesn't exist at the project root, check first whether
   `/newgoal` already ran for a `research`-type ask in this conversation — that path deliberately
   skips `GOALS.md` and produces a standalone deliverable document instead (see `newgoal.md`'s
   research-type exception). If so, say that plainly: there's nothing to execute because the goal
   was research-only and already delivered, not because a step was missed. Otherwise, stop and
   say so — run `/newgoal` first. This command executes a plan, it doesn't improvise one;
   building without the research pass defeats the reason `/newgoal` exists.

2. **Read the whole file first**, then present a short summary before touching anything: which
   areas apply (backend/frontend/database/etc. — whichever `/newgoal` actually wrote for this
   project), how many items are already `[x]` vs. still open, and which open items are
   heavier/harder to reverse — installing dependencies, initializing a database, running an
   external scaffolding CLI, `git init`. An explicit `/execgoals` invocation already authorizes
   the auto-approved and notify-and-proceed work in the ordered run; ask only if an open item is
   human-in-the-loop. That preserves one coherent safety gate without re-asking for ordinary
   in-scope implementation.

3. **Work through unchecked items in the order they're written.** `/newgoal` already orders
   items "what has to exist before what" — don't re-derive an order here. For each item:
   - **Auto-approved**: trivial, routine, reversible work inside the current repository applies
     directly.
   - **Notify-and-proceed**: a non-trivial but in-scope, reversible item uses the `architect` →
     `coder` subagent workflow; state the visible effect, then continue and verify it.
   - **Human-in-the-loop**: an irreversible or hard-to-recover action, a material choice only
     the user can make (which OAuth provider, cloud region, or real credential), data/state
     outside the repository, sensitive data, or external publication stops and asks. Never
     fabricate a placeholder that looks real. Secrets go in the project's own gitignored `.env`,
     never hardcoded.

4. **Check items off as they're verified, not as they're attempted.** After completing an item,
   actually confirm it — the file exists, the test passes, the server starts — the same
   "exists / substantive / wired" standard `reviewer` already applies to code review, not just
   editing the checkbox because the edit happened. Update `GOALS.md` in place (`[ ]` → `[x]`) as
   you go, so a later re-run of this command sees accurate progress and never redoes finished
   work.

   After a batch of edits to the same `GOALS.md` within one area, run
   `node ~/.claude/base_project/scripts/validate-goals-structure.js GOALS.md`. If it reports a
   finding, repair the plan structure and leave the affected item open before continuing.

4a. **Archive a section once every item under it is `[x]`.** When checking off an item leaves
    every item in its `GOALS N` section checked, that section is done — move it out of the root
    file: write its full body to `dev/goals-archive/goals-NN-<slug>.md` (kebab-case from the
    heading, matching the existing archive's naming), compute its SHA-256 over the new file's
    bytes, append one row to `dev/goals-archive/README.md`'s table (plan name, `completed`,
    link, checksum), and remove the section — including its "Active plans" list entry — from
    the root `GOALS.md`. This is auto-approved, repo-local, reversible work; it doesn't need
    separate confirmation beyond the run's own authorization. Re-run
    `validate-goals-structure.js` after the move, same as any other edit batch.

5. **Run the project's own test/lint/typecheck after each area finishes**, not only at the very
   end — catch a broken area before three more areas get built on top of it.

6. **If interrupted or partially done, resuming just works.** Re-running this command reads the
   current `[x]`/`[ ]` state and continues from the first open item — it never restarts from
   zero, and never redoes something already checked off without being asked to.

7. **Report**: what got built (grouped by area), what's still open and why (a decision still
   pending, a check that failed), and the current `GOALS.md` completion count. Never commit
   automatically — same rule as `/fixproject`; offer that `reviewer` can prepare a commit once
   there's something worth committing, and wait for explicit confirmation.

$ARGUMENTS
