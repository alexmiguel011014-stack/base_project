---
# base_project:managed
description: Execute the build plan in GOALS.md — scaffold, wire, and install each item in order, checking items off as they're verified done. The execution counterpart to /newgoal.
---

Execute `GOALS.md` at the project root: turn the plan `/newgoal` researched into a real, working
project, one ordered item at a time — with the same before/after verification discipline as
`/fixproject`, not "apply a patch and assume it worked."

1. **Require a plan.** If `GOALS.md` doesn't exist at the project root, stop and say so — run
   `/newgoal` first. This command executes a plan, it doesn't improvise one; building without
   the research pass defeats the reason `/newgoal` exists.

2. **Read the whole file first**, then present a short summary before touching anything: which
   areas apply (backend/frontend/database/etc. — whichever `/newgoal` actually wrote for this
   project), how many items are already `[x]` vs. still open, and which open items are
   heavier/harder to reverse — installing dependencies, initializing a database, running an
   external scaffolding CLI, `git init`. Ask for one confirmation to proceed with the whole
   ordered run, not per item — the same one-pass-then-report shape `/fixproject` already uses,
   just with a heavier first step, since unlike a fix this can install real dependencies and
   create real service state.

3. **Work through unchecked items in the order they're written.** `/newgoal` already orders
   items "what has to exist before what" — don't re-derive an order here. For each item:
   - Trivial items (create a config file, add a `.gitignore` line) apply directly.
   - Non-trivial items use the `architect` → `coder` subagent workflow, same as any other real
     change in this project.
   - If an item needs a decision only the user can make (which OAuth provider, which cloud
     region, a real API key/credential), stop and ask — never fabricate a placeholder that
     looks real. Secrets go in the project's own gitignored `.env`, never hardcoded, same rule
     as everywhere else in this project.

4. **Check items off as they're verified, not as they're attempted.** After completing an item,
   actually confirm it — the file exists, the test passes, the server starts — the same
   "exists / substantive / wired" standard `reviewer` already applies to code review, not just
   editing the checkbox because the edit happened. Update `GOALS.md` in place (`[ ]` → `[x]`) as
   you go, so a later re-run of this command sees accurate progress and never redoes finished
   work.

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
