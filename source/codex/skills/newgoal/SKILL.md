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
### Codex-specific model mapping

For Codex plans, use the following model + effort mapping for each module's `Suggested:` line and for the final recommendation:
- `gpt-5.6-luna · low` for routine, mechanical, low-risk work.
- `gpt-5.6-terra · medium` for typical implementation work.
- `gpt-5.6-sol · high` for difficult work spanning multiple systems.
- `gpt-6-astra · xhigh` for high-cost-of-failure work such as migrations, auth/security, infrastructure, or destructive operations.
Resolve availability against the models visible in the active Codex surface. If the preferred model is unavailable, fall back in this order: `gpt-6-astra` → `gpt-5.6-sol` → `gpt-5.6-terra` → `gpt-5.6-luna`. Preserve the requested effort when the fallback supports it; if the effort changes, disclose both the fallback and the changed effort. Do not use the Claude-only model vocabulary for Codex recommendations.

6. Write the plan in English as ordered, checkable items grouped by the selected goal type's areas. Tag manual work explicitly and define “Done when” evidence. Put a small Mermaid dependency flowchart under each `GOALS N` heading, and right after it one line — `Suggested: <Codex model> · <effort> — <reason>` — using the Codex-specific mapping above and the module's own risk/complexity. A suggestion is applied by hand, never an automatic mid-session switch.
7. If `GOALS.md` exists, read the active root file and merge; never overwrite prior plans silently. If `dev/goals-archive/README.md` exists, read its index too and open individual archived plans only when historic scope/evidence is relevant. Use unique section and item identifiers.
8. For a purely research-only goal with no later implementation, follow `research.md` and write the standalone deliverable instead of ceremonial `GOALS.md` checkboxes.
9. Report the path and a short outline. After the path/outline, end with exactly one
   localized final sentence in the user's language. That sentence must contain exactly one bold
   `**<Codex model> · <effort>**` pair, a concrete reason tied to the plan's highest-risk module,
   and an explicit manual-only disclaimer stating that it does not automatically change the
   selected model, effort, or Codex configuration. Ask in that same sentence whether the user
   wants to proceed with `$execgoals` or adjust the plan first. Do not satisfy this contract with
   only a `Suggested:` line inside `GOALS.md`, do not add another recommendation sentence, and
   do not begin implementation.
