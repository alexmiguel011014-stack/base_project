---
# base_project:managed
name: execgoals
description: Execute unchecked items in GOALS.md in dependency order and mark only behaviorally verified work complete. Use only for $execgoals or an explicit request to execute an existing goal plan.
---

Turn an existing `GOALS.md` into verified implementation.

 ### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan or safety boundaries.


1. Require `GOALS.md`. If the preceding `$newgoal` was research-only and intentionally produced a standalone document, explain that there is nothing to execute. Otherwise stop and direct the user to `$newgoal`; never improvise a missing plan.
2. Read only what the run needs: the `Active plans` list and `## Owner backlog`. If `$ARGUMENTS` names a plan (`GOALS 21` or `21`), select it; otherwise select the first plan with an open non-owner item. Read that section and each section its `after:` fields name. Do not read other sections. Summarize completed/open counts, applicable areas, and high-impact or hard-to-reverse items. An explicit `$execgoals` invocation authorizes routine plan execution; ask only for an unresolved choice or human-in-the-loop item.
2a. Preflight before the first edit. Confirm each `(exists)` path is present and each `Anchor:` matches verbatim. Run the project's test/lint/typecheck once for a baseline. If an anchor does not match, a `(new)` path already exists, or an item says `(unverified — confirm before executing)`, stop at that item and report plan drift. Tell the user to update `GOALS.md` or rerun `$newgoal`; never to improvise a substitute edit. Items that passed preflight may proceed. A section without `<!-- item-contract: v1 -->` skips anchor checks but records the baseline.
3. Continue from the first unchecked item. Never redo `[x]` items unless asked. Follow written dependencies; do not derive a new plan. For old-format plans, apply the declared owner: trivial reversible work in this repository is auto-approved; state an in-scope visible change as notify-and-proceed and continue; stop for irreversible or hard-to-recover actions, material choices, external data/state, sensitive data, credentials, or publication.
3a. Executor-v1 plans. If the selected section has `Format: executor-v1`, use this step instead of steps 3, 4, and 5. Take open items in written order when every `after:` item is `[x]`:
   - If `tier: user`, list the item as owner work and continue to the next item.
   - If `gate: ask`, ask and wait. If `gate: notify`, state the visible effect in one line.
   - Send `light` and `standard` items to the `coder` agent. Run `strong` items in this session. The tier is advisory in Codex. Pass the item text verbatim and nothing else from this conversation. Tell the agent to edit only paths in `files:` and return `BLOCKED: <reason>` if a step is impossible as written.
   - Run the item's `check:` yourself. The executor's report is not proof.
   - If the check passes, mark the item `[x]` and add `- proof: <check result>, <YYYY-MM-DD>, <executor>`.
   - If the check fails, run the executor once more at the same tier with the check output. If it fails again and the tier is not `strong`, run it once at the next tier. If it still fails, add `- blocked: <check output, one line>`, stop, and report.
   - Stop and report if the executor returns `BLOCKED` or edits a path outside `files:`. Do not mark that item.
   Plans without `Format: executor-v1` keep steps 3, 4, and 5.
4. For old-format plans, use the declared owner: do exact `Change:` text directly; run architecture analysis first only when the owner is `architect` or a specification still leaves a design question. Keep manual items open until the user supplies the required evidence. If an item has `Verify:`, run it and compare the expected result.
5. Mark an old-format item `[x]` only after the artifact exists, is substantive, is wired into the system, and has behavioral proof. If verification fails, keep `[ ]` and record the blocker.
5a. **CDP mode.** If the current `$execgoals` invocation arguments contain a standalone, case-insensitive token `cdp`, `/cdp`, `$cdp`, or `--cdp`, inspect only those arguments for a match; never scan `GOALS.md` or project files. Say once that CDP mode is on for this invocation, read `~/.codex/base_project/references/cdp-verification.md` in full before verifying the first item, and apply it to every item with a browser-reachable UI. Check off such an item only with the CDP evidence that reference defines. For an item without a browser-reachable UI, say `cdp: not applicable` and verify it as usual. Without a matching token, never start a browser with a debug port.
5b. Archive a section after all its items are `[x]`: write its full body to `dev/goals-archive/goals-NN-<slug>.md`, compute its SHA-256, add a row to `dev/goals-archive/README.md`, and remove the section and its `Active plans` entry. Re-run the structure validator. If the project's `CLAUDE.md` names a command that writes the archive checksums, use that command and run its check mode. An executor-v1 section may also be archived when every item is `[x]` except `tier: user` items. Before archiving, copy each open owner item unchanged to the root `## Owner backlog`, with ` (GOALS N)` after its title. If that section does not exist, create it with the line `Owner items left open by archived plans. Mark them done here.` Old-format sections are archived only when every item is `[x]`.
6. After a batch of edits to the same `GOALS.md` within one area, run `node ~/.claude/base_project/scripts/validate-goals-structure.js GOALS.md`; repair any finding and leave the affected item open before continuing. Run the project's own relevant checks after each area, not just at the end. Preserve unrelated user changes.
7. If interrupted, leave accurate checkbox state so the next `$execgoals` resumes safely.
8. Report work completed, remaining blockers, and exact completion count. Never commit automatically; `$ship` is separate.
