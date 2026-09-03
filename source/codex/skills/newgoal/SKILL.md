---
# base_project:managed
name: newgoal
description: Research and write a detailed executable plan in GOALS.md. This is planning-only and must never implement the plan. Use for $newgoal or an explicit request to create a base_project goal.
---

Produce `GOALS.md` at the project root as the researched input for `$execgoals`.

**Hard boundary: never execute.** This skill may write only `GOALS.md`, or the standalone document allowed for a pure research goal. It never scaffolds, installs, builds, edits implementation files, or executes an existing plan—even if the request sounds fully approved. Execution requires `$execgoals` or a separate explicit request.

1. Reuse context already established. Ask one brief round only for missing stack, project kind, or greenfield/existing state.
2. Read `~/.codex/base_project/references/project-standards.md`.
3. Classify the request and read the matching file under `~/.codex/base_project/references/goal-types/`:
   - `research.md` for a standalone report or investigation;
   - `fix.md` for reproducible broken behavior;
   - `feature.md` for a bounded addition to a working system;
   - `process.md` for governance, CI, distribution, legal, or other non-product-code work;
   - `build.md` for a full greenfield system.
4. Research current facts and concrete technical choices deeply enough that execution does not need to redo the discovery. Browse when facts may have changed or authoritative sources matter.
5. If `$repertoire` was requested together, finish its domain research first and use `REPERTOIRE.md` as input. If `$council` was also requested, use it only for genuinely contested decisions and honor its separate token-cost confirmation.
6. Write the plan in English as ordered, checkable items grouped by the selected goal type's areas. Tag manual work explicitly and define “Done when” evidence. Put a small Mermaid dependency flowchart under each `GOALS N` heading.
7. If `GOALS.md` exists, read and merge; never overwrite prior plans silently. Use unique section and item identifiers.
8. For a purely research-only goal with no later implementation, follow `research.md` and write the standalone deliverable instead of ceremonial `GOALS.md` checkboxes.
9. Report only the path and a short outline. Do not begin implementation.

