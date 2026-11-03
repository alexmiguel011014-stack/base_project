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
5. If `$repertoire` was requested together, finish its domain research first and use `REPERTOIRE.md` as input. If `$council` was also requested, use it only for genuinely contested decisions, honor its separate token-cost confirmation, and record its verdict as a `### Decisions` line.
### Codex-specific model mapping

Plans use runtime-neutral tiers. In Codex, map each tier to a model for the final recommendation and wherever a tier is applied:
- `light · low` → `gpt-5.6-luna · low` for routine, mechanical, low-risk work.
- `standard · medium` → `gpt-5.6-terra · medium` for typical implementation work.
- `strong · high` → `gpt-5.6-sol · high` for difficult work spanning multiple systems.
- `strong · xhigh` → `gpt-6-astra · xhigh` for high-cost-of-failure work such as migrations, auth/security, infrastructure, or destructive operations.
Resolve availability against the models visible in the active Codex surface. If the preferred model is unavailable, fall back in this order: `gpt-6-astra` → `gpt-5.6-sol` → `gpt-5.6-terra` → `gpt-5.6-luna`. Preserve the requested effort when the fallback supports it; if the effort changes, disclose both the fallback and the changed effort. Do not use the Claude-only model vocabulary for Codex recommendations.

6. Write `GOALS.md` in English as an executor-v1 plan. Read `~/.codex/base_project/references/ai-writing-standard.md` first. Follow its Part A and its glossary. The user does not read this file; `$execgoals` and its executors do. Write for an executor that cannot ask questions and makes no design choice.
   - Under the `## GOALS N — <title> (<project> <type>)` heading, write the line `Format: executor-v1`. Then write a scope of three sentences or fewer.
   - Write `### Decisions` next, one line per decision: `- D<n> <decision>. Why: <one clause>. Source: <URL or file>.` No item holds an open choice.
   - Group items by the goal type's areas, in the type's order. Start each item with `- [ ] **<ID> <imperative title>**`. Give it these sub-bullets: `tier: <light|standard|strong> · <low|medium|high|xhigh>`, `gate: <auto|notify|ask>`, `after: <item IDs, or none>`, `files: <paths> (new|edit)`, `do:` with numbered steps, `check: <command run from the project root> → <expected result>`. `stop-if: <condition>` is optional.
   - One item is one executor run: 5 files or fewer and 10 steps or fewer. Split a larger item.
   - Give the exact text to write, the exact anchor line, exact names and values.
   - `check:` must be a command whose exit code or output proves the item. The executor's report is never proof.
   - Owner work: `tier: user`, `gate: ask`, `check: manual — <what the user observes>`.
   - Tier: `light` when the step gives the exact content; `standard` for code from a clear spec; `strong` for logic across files, open debugging, or security. Use effort `xhigh` only for irreversible, security, or migration work.
   - Gate: `auto` for reversible work inside the repository; `notify` when the effect is visible; `ask` for irreversible or external work, credentials, or a material choice.
   - Do not write a Mermaid diagram or a `Suggested:` line. `after:` is the order; `tier:` is the routing.
7. If `GOALS.md` exists, read the active root file and merge; never overwrite prior plans silently. If `dev/goals-archive/README.md` exists, read its index too and open individual archived plans only when historic scope/evidence is relevant. Read the `## Owner backlog` section of the root `GOALS.md` if it exists; do not repeat its items in a new plan. Use unique section and item identifiers.
8. For a purely research-only goal with no later implementation, follow `research.md` and write the standalone deliverable instead of ceremonial `GOALS.md` checkboxes.
9. Report in the user's language, answer first, in five lines or fewer: the path, the number of
   items per tier, and the items with `gate: ask` or `tier: user`. Do not describe the items.
   End with exactly one localized final sentence in the user's language. That sentence must
   contain exactly one bold `**<Codex model> · <effort>**` pair for the `$execgoals` session,
   which only dispatches, runs checks and escalates: `gpt-5.6-terra · medium` unless an `ask`
   item needs more. Give a concrete reason and an explicit manual-only disclaimer stating that it
   does not automatically change the selected model, effort, or Codex configuration. Ask in that
   same sentence whether the user wants to proceed with `$execgoals` or adjust the plan first.
   Do not add another recommendation sentence, and do not begin implementation.
