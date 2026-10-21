---
# base_project:managed
name: execgoals
description: Execute unchecked items in GOALS.md in dependency order and mark only behaviorally verified work complete. Use only for $execgoals or an explicit request to execute an existing goal plan.
---

Turn an existing `GOALS.md` into verified implementation.

 ### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan, safety, or diary boundaries.


1. Require `GOALS.md`. If the preceding `$newgoal` was research-only and intentionally produced a standalone document, explain that there is nothing to execute. Otherwise stop and direct the user to `$newgoal`; never improvise a missing plan.
2. Read only what the run needs: the `Active plans` list and the `## Owner backlog` section. If `$ARGUMENTS` names a plan (`GOALS 19` or `19`), select it; otherwise select the first plan in the list with an open item that is not an owner item. Read that plan's section and each section its `after:` fields name; do not read other sections. Summarize completed/open counts, applicable areas, and high-impact or hard-to-reverse items. Explicit `$execgoals` invocation authorizes routine plan execution; ask only for an unresolved choice or a human-in-the-loop item.
3. Continue from the first unchecked item; never redo `[x]` items unless asked. Follow written dependencies rather than deriving a new plan. Treat routine reversible work inside the repository as **auto-approved**; state and continue for an in-scope, reversible but visible **notify-and-proceed** change; stop for **human-in-the-loop** work: irreversible/hard-to-recover actions, material scope choices, outside-repository data/state, sensitive data, credentials, or external publication.
3a. Executor-v1 plans. If the selected section has the line `Format: executor-v1`, follow this step instead of steps 3, 4 and 5. Take each open item in written order once every item in its `after:` field is `[x]`:
   - If the item has `tier: user`: list it as owner work and go to the next item.
   - If it has `gate: ask`: ask, and wait. If it has `gate: notify`: state the visible effect in one line.
   - Spawn the `coder` agent for `light` and `standard` items. Run `strong` items yourself. The tier is advisory in Codex. Pass the item text verbatim and nothing else from this conversation. Tell the agent to edit only the paths in `files:` and to return `BLOCKED: <reason>` if a step is impossible as written.
   - Run the item's `check:` yourself. The executor's report is not proof.
   - If the check passes: mark the item `[x]` and add one line under it: `- proof: <check result>, <YYYY-MM-DD>, <model>`.
   - If the check fails: run the executor once more at the same tier with the check output. If it fails again and the tier is not `strong`: run it once at the next tier up (after `standard`, that means running it yourself). If it still fails: add `- blocked: <check output, one line>` under the item, stop the run, and report.
   - Stop the run and report if the executor returns `BLOCKED` or changed a file outside `files:`. Do not mark that item.
   Plans without the `Format: executor-v1` line keep steps 3, 4 and 5 as written.
4. For each item, use the declared owner: architecture analysis first where required, surgical implementation next, and manual items left open until the user supplies the required evidence.
5. Mark `[x]` only after all four gates pass: the artifact exists, is substantive, is wired into the system, and has behavioral proof. If verification fails, keep `[ ]` and record the blocker.
5a. Once every item under a `GOALS N` section is `[x]`, archive it: write the section body to `dev/goals-archive/goals-NN-<slug>.md` (kebab-case from the heading), compute its SHA-256, add a row to `dev/goals-archive/README.md`, and remove the section (and its "Active plans" entry) from the root file. Auto-approved, repo-local, reversible — no separate confirmation beyond the run's own authorization. Re-run the structure validator afterward. An executor-v1 section is also done when every item is `[x]` except `tier: user` items. Before you move it, copy each open `tier: user` item, unchanged, to the `## Owner backlog` section at the end of the root `GOALS.md`, with ` (GOALS N)` after its bold title; if that section does not exist, create it with the line `Owner items left open by archived plans. Mark them done here.` Old-format sections are archived only when every item is `[x]`.
6. After a batch of edits to the same `GOALS.md` within one area, run `node ~/.claude/base_project/scripts/validate-goals-structure.js GOALS.md`; repair any finding and leave the affected item open before continuing. Run the project's own relevant checks after each area, not just at the end. Preserve unrelated user changes.
7. If interrupted, leave accurate checkbox state so the next `$execgoals` resumes safely.
8. Report work completed, remaining blockers, and exact completion count. Never commit automatically; `$ship` is separate.
