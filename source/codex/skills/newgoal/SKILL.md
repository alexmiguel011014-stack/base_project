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
5. If `$repertoire` was requested with this skill, finish its research first and use `REPERTOIRE.md` as input. If `$council` was also requested, use it only for genuinely contested decisions, honor its separate confirmation, and record its verdict under `### Decisions`.
5a. Ground every reference before writing the plan. Open every file the plan will edit. Copy each anchor from the current file. Verify each path, symbol, command, flag, and test name. Record `git rev-parse --short HEAD` in the section's first paragraph. Cite each external fact per item. If a fact is unverified, write `(unverified — confirm before executing)`; the executor must stop at that item.
6. Write `GOALS.md` in English as an executor-v1 plan. Read `~/.codex/base_project/references/ai-writing-standard.md` first. Follow Part A and its glossary. Write for an executor that cannot ask questions or make design choices.
   - Under each `## GOALS N — <title> (<project> <type>)` heading, write `Format: executor-v1`, then a scope of three sentences or fewer and a `### Decisions` list that settles every choice.
   - Group items by the selected goal type's areas, in their required order. Start each item with `- [ ] **<ID> <imperative title>**`.
   - Give every item these required fields: `tier: <light|standard|strong> · <low|medium|high|xhigh>`, `gate: <auto|notify|ask>`, `after: <item IDs, or none>`, `files:`, numbered `do:` steps, and `check:`.
   - Mark each path in `files:` as `(new)` or `(exists)`. Add the exact `Anchor:`, `Change:`, `Do not touch:`, `Verify:`, and `Source:` details. Copy anchors from current files. Give exact text or a precise specification. Give each check command and its expected result. Cite external facts with a URL and access date.
   - Mark user work as `tier: user`, `gate: ask`, and `check: manual — <what the user observes>`. Use effort `xhigh` only for irreversible, security, or migration work.
   - Keep each item to three files or fewer and ten steps or fewer. Split any item that exceeds either limit or still has a choice.
   - Open each section with a stage map table: `Stage | Items | Depends on | Can run in parallel with`. Put `<!-- item-contract: v1 -->` under the table. Do not include a Mermaid diagram or recommend a model or effort.
   - Write checklist items in controlled English, modeled on ASD-STE100. Use one instruction per sentence. Keep instructions to 20 words or fewer and descriptive sentences to 25 words or fewer. Use active voice, stable names, articles, and concrete words. Avoid vague terms such as "as needed" and "etc."
7. If `GOALS.md` exists, read and merge the active root plan. If `dev/goals-archive/README.md` exists, read its index and open an archived plan only when its history matters. Read the `## Owner backlog` section if it exists; do not repeat its items. Keep `GOALS.md` tracked in version control. Use unique section and item identifiers.
8. For a pure research goal with no later implementation, use `research.md` and write the standalone deliverable instead of `GOALS.md`.
9. Report in the user's language, answer first, in five lines or fewer. State the file path, item count per tier, and every `gate: ask` or `tier: user` item. Include the stage map when this skill runs directly. Do not describe the items or recommend a model or effort. Ask whether the user wants to proceed with `$execgoals` or adjust the plan first. Do not begin implementation.
