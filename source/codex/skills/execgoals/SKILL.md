---
# base_project:managed
name: execgoals
description: Execute unchecked items in GOALS.md in dependency order and mark only behaviorally verified work complete. Use only for $execgoals or an explicit request to execute an existing goal plan.
---

Turn an existing `GOALS.md` into verified implementation.

1. Require `GOALS.md`. If the preceding `$newgoal` was research-only and intentionally produced a standalone document, explain that there is nothing to execute. Otherwise stop and direct the user to `$newgoal`; never improvise a missing plan.
2. Read the whole file. Summarize completed/open counts, applicable areas, and high-impact or hard-to-reverse items. Explicit `$execgoals` invocation authorizes routine plan execution; ask only for an unresolved choice or a destructive/hard-to-reverse item that the plan did not already authorize.
3. Continue from the first unchecked item; never redo `[x]` items unless asked. Follow written dependencies rather than deriving a new plan.
4. For each item, use the declared owner: architecture analysis first where required, surgical implementation next, and manual items left open until the user supplies the required evidence.
5. Mark `[x]` only after all four gates pass: the artifact exists, is substantive, is wired into the system, and has behavioral proof. If verification fails, keep `[ ]` and record the blocker.
6. Run the project's own relevant checks after each area, not just at the end. Preserve unrelated user changes.
7. If interrupted, leave accurate checkbox state so the next `$execgoals` resumes safely.
8. Report work completed, remaining blockers, and exact completion count. Never commit automatically; `$ship` is separate.
