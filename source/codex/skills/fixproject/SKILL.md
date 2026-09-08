---
# base_project:managed
name: fixproject
description: Implement and verify findings from $scanproject or $cleanproject. Use when the user explicitly asks to fix project findings, not merely diagnose them.
---

Apply project fixes with before-and-after evidence.

 ### Batching and stopping
- Batch independent reads and checks, reuse evidence already gathered, and validate once at each area boundary. Stop after the scoped work is verified complete or a real blocker requires user input; do not speculate, retry blindly, or continue into unrelated work. Never use batching or stopping to bypass plan, safety, or diary boundaries.


1. Reuse findings already established in the conversation or a report. If none exist, run the read-only `$scanproject` workflow first.
2. Present the concrete findings to be fixed. An explicit `$fixproject` invocation authorizes ordinary reversible fixes in that scope; ask only if the scope is ambiguous or an item is destructive/hard to reverse. Do not silently include unrelated cleanup.
3. For non-trivial work, use the `architect` subagent before delegating surgical implementation to `coder`; use the current thread when those subagents are unavailable.
4. Before each fix, record the failing evidence. Preserve unrelated and pre-existing user changes.
5. Apply the smallest correct change. Never use destructive git recovery commands to erase local work.
6. Re-run the exact failing check, then the project's own relevant lint, typecheck, tests, and build. A code-shaped patch is not proof.
7. Report fixed, skipped, and still-failing items separately. Never commit automatically; `$ship` handles that after explicit invocation.
