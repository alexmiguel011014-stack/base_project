---
# base_project:managed
description: Research and write a single, deeply detailed 0-to-100% build plan for the current project — backend, frontend, connectivity, database, deployment, everything — as GOALS.md.
---

Produce `GOALS.md` at the project root: the closest thing this project has to a master plan,
detailed enough that `/execgoals` can execute against it without re-researching anything — this
command's whole job is to produce the input `/execgoals` consumes. This is a research-heavy, front-loaded command — spend real depth now so nothing has
to be rediscovered later.

**This command never implements anything** — not the plan it just wrote, not a request that
already reads as fully specified, not something already agreed through a prior confirmation
exchange in this same conversation. Producing the plan (or, for a pure `research`-type ask,
the research deliverable) is the entire job; running it is exclusively `/execgoals`'s.

1. **Gather context without re-asking.** If this session already established the stack, kind
   of project, and starting state earlier in the conversation, reuse it — do not repeat the
   questions. Otherwise ask one brief round: stack/language, kind of project, greenfield vs.
   existing — skip anything already obvious from the current directory.

2. **Read `~/.claude/base_project/references/project-standards.md` first** — it's the shared
   definition of what a well-formed project looks like (identity, version control, secrets,
   dependencies, tests, lint/typecheck, CI, basic security, structure) and every plan produced
   here should satisfy it, not reinvent it from scratch.

3. **Classify the goal type before researching or writing anything.** Every plan this command
   writes is one of five types, each with its own defaults, areas, and definition of "done" —
   read `~/.claude/base_project/references/goal-types/<type>.md` in full for whichever one
   fits before doing anything else:

   ```mermaid
   flowchart TD
       A[Goal request] --> B{Deliverable is code/config,\nnot a standalone document?}
       B -- No, deliverable is a report/analysis --> R[research.md]
       B -- Yes --> C{Something is currently broken,\nreproducible bad behavior?}
       C -- Yes --> F[fix.md]
       C -- No --> D{Bounded addition to something\nthat already works?}
       D -- Yes --> E[feature.md]
       D -- No --> G{Non-code: legal, CI, governance,\ndistribution, community docs?}
       G -- Yes --> P[process.md]
       G -- No, full stack 0-to-100% --> BU[build.md]
   ```

   If the classification is genuinely ambiguous even after walking the flowchart, ask the user
   one short question rather than guessing — same standard as step 1's brief context round. If
   a plan is mostly one type with a minority of items from another (research feeding a build,
   a process pass that also fixes a found bug), classify by what the request is centered on —
   the dominant type's module governs the section; don't run a second full classification pass
   for a handful of items.

   **Never reuse `build.md`'s stack-area breakdown (Backend/Frontend/Database/...) for a goal
   that isn't actually a Build** — forcing every plan through that one template regardless of
   type is exactly what this classification step exists to stop; it previously meant a
   Process-type plan (see `GOALS.md`'s own "Public Release Readiness" section) had to fight the
   Build template area by area, most areas marked "does not apply."

   **Pure `research`-type asks with nothing to execute after are the one exception to writing
   `GOALS.md` at all.** If the whole goal is "investigate/compare/report" with no follow-on
   build/fix/feature to track, skip `GOALS.md` and produce the deliverable document directly
   per `research.md`'s done-when convention — wrapping a single research deliverable in a
   checklist file adds ceremony `/execgoals` can't use anyway. If the research instead feeds a
   later build or feature (the request says so, or a follow-up is clearly implied), write it as
   its own `GOALS.md` section using `research.md`'s items, ordered before the section that
   depends on it.

4. **Research for real, in one pass, as deep as the chosen type needs** — this is a single
   front-loaded research effort, not an open-ended crawl to repeat every session. Use web
   search for current best practices and concrete tool/library choices where that applies to
   the chosen type (a `build`-type plan for a full-stack app needs far more of this than a
   `fix`-type plan, where the research is root-cause investigation, not library comparison) — a
   vague plan the user has to fill in themselves defeats the point of this command.

4a. **If `/council` was invoked together with this command** (e.g. `/newgoal /council` in the
    same message): for each item where the choice is genuinely contested rather than a clear
    default (a real fork like monolith vs. microservices or SQL vs. NoSQL, not "which test
    runner" when the stack has one obvious pick), run `/council` on that specific decision —
    including its own confirmation gate — before writing the choice into `GOALS.md`. Record
    the President's verdict as a `### Decisions` line, not the full 5-advisor transcript.

4b. **If `/repertoire` was invoked together with this command** (e.g. `/newgoal /repertoire` in
    the same message): let `/repertoire` finish first
    — it researches the project's actual subject matter (scientific/regulatory/cultural/media),
    not tech choices — and read the `REPERTOIRE.md` it produces before running this step's own
    research. `/repertoire` researches *what the project is about*; this step researches *how to
    build it*; don't let the two blur into one pass or skip reading the briefing once it exists.

4c. **Ground every reference before writing the plan.** Open each file the plan will edit, copy each anchor from the current file, and verify every path, symbol, command, flag, and test name. Record `git rev-parse --short HEAD` in the section's first paragraph. Cite each external fact per item. If a fact is unverified, write `(unverified — confirm before executing)`; the executor must stop at that item.

5. **Write `GOALS.md` in English as an executor-v1 plan.** Read `~/.claude/base_project/references/ai-writing-standard.md` first. Follow Part A and its glossary. The user does not read this file; `/execgoals` and its executors do. Write for an executor that cannot ask questions or make design choices.
   - Under each `## GOALS N — <title> (<project> <type>)` heading, write `Format: executor-v1`, then a scope of three sentences or fewer and a `### Decisions` list that settles every choice.
   - Group items by the selected goal type's areas, in their required order. Start each item with `- [ ] **<ID> <imperative title>**`.
   - Give every item these required fields: `tier: <light|standard|strong> · <low|medium|high|xhigh>`, `gate: <auto|notify|ask>`, `after: <item IDs, or none>`, `files:`, numbered `do:` steps, and `check:`.
   - Mark each file in `files:` as `(new)` or `(exists)`. Add the exact `Anchor:`, `Change:`, `Do not touch:`, `Verify:`, and `Source:` details. Copy anchors from current files. Give exact text or a precise specification. Give each check command and its expected result. Cite each external fact with a URL and access date.
   - Mark owner work as `tier: user`, `gate: ask`, and `check: manual — <what the user observes>`. Use effort `xhigh` only for irreversible, security, or migration work.
   - Keep each item to three files or fewer and ten steps or fewer. Split any item that exceeds either limit or still contains a choice.
   - Open each section with a stage map table: `Stage | Items | Depends on | Can run in parallel with`. Put `<!-- item-contract: v1 -->` under the table. Do not include a Mermaid diagram or recommend a model or effort.
   - Write checklist items in controlled English, modeled on ASD-STE100. Use one instruction per sentence. Keep instructions to 20 words or fewer and descriptive sentences to 25 words or fewer. Use active voice, stable names, articles, and concrete words. Avoid vague terms such as "as needed" and "etc."

6. **Never overwrite silently.** If `GOALS.md` already exists, read the active root file first
   and merge new findings rather than discarding them. If `dev/goals-archive/README.md` exists,
   read that index too; open an individual archived plan only when historic scope or evidence is
   relevant, so completed detail does not become default planning context. Read the
   `## Owner backlog` section of the root `GOALS.md` if it exists; do not repeat its items in a
   new plan. Say plainly what changed if this was called directly. `GOALS.md` is meant to be tracked in version control like
   `README.md`, not gitignored: it's project documentation the user keeps, not a regenerable
   artifact.

7. **Report in the user's language, answer first, in five lines or fewer.** State the file path, item count per tier, and every `gate: ask` or `tier: user` item. Include the stage map when this command runs directly. Do not describe the items or recommend a model or effort. Ask whether the user wants to proceed with `/execgoals` or adjust the plan first.


8. **Never execute.** This command writes `GOALS.md` (or the standalone research deliverable)
   — full stop. It never edits other files, never runs installs/builds/scaffolding, and never
   implements a prior `GOALS.md`'s items, no matter how complete the request already sounds or
   how thoroughly it was already agreed earlier in the conversation. If there's something to
   build, the next step is `/execgoals` (or an explicit separate ask) — never this command, in
   the same turn or any other.

$ARGUMENTS
