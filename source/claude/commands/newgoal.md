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
    the President's verdict as the item, not the full 5-advisor transcript.

4b. **If `/repertoire` was invoked together with this command** (e.g. `/newgoal /repertoire` in
    the same message): let `/repertoire` finish first
    — it researches the project's actual subject matter (scientific/regulatory/cultural/media),
    not tech choices — and read the `REPERTOIRE.md` it produces before running this step's own
    research. `/repertoire` researches *what the project is about*; this step researches *how to
    build it*; don't let the two blur into one pass or skip reading the briefing once it exists.

4c. **Ground every reference before writing it.** Open each file the plan will edit and copy
    its anchors from what is actually there; search for every function, flag, path, command,
    and test name the plan mentions and correct or drop any that does not exist. Record the
    commit the plan was grounded against (`git rev-parse --short HEAD`) in the section's first
    paragraph. Facts about the outside world (versions, APIs, defaults) come from a source
    read in this pass and cited per item; when no source was read, the item says so instead
    of stating the fact from memory.

5. **Write `GOALS.md` in English**, regardless of the conversation's language — this file is
   meant to be read by `/execgoals` as much as by the user, and the user
   asked for it explicitly. Structure it as concrete, checkable items grouped by the chosen
   module's areas, not prose paragraphs — each item should be something a future execution pass
   can look at and know whether it's done, tagged `(manual)` per that module's convention
   wherever `/execgoals` cannot just run it alone. Order the items using the chosen module's
   ordering rule: what has to exist before what.

   Immediately under each `GOALS N` heading, include a short Mermaid `flowchart` diagram
   showing the dependency order between that section's areas or major items — the same
   ordering already being decided for the checklist itself, just made visually scannable
   (GitHub renders Mermaid natively, and ordering mistakes in a large plan are far easier to
   spot in a graph than in a list). Keep it to area/subsystem-level nodes, not one node per
   checkbox — a node per item is noise past a handful of items.

5a. **Write every item to the executable item contract.** The executor may be a weaker
    model with none of this research in its context; every judgment call left inside an item
    becomes a guess there. Put the line `<!-- item-contract: v1 -->` under each new
    `GOALS N` section's stage map so the structure validator checks the fields, and give
    every item these sub-bullets, in this order:
    - `Files:` every path the item creates or edits, each marked `(new)` or `(exists)`; an
      `(exists)` path was opened during this planning pass, not assumed.
    - `Anchor:` for an edit to an existing file, a line or unique heading copied verbatim
      from that file during this pass, so the executor finds the location instead of
      inferring it.
    - `Change:` the exact text to add or replace when it is about 15 lines or fewer;
      otherwise a precise specification — names, signatures, inputs, outputs, error cases.
      Never "improve", "clean up", "update as needed", or "handle appropriately".
    - `Do not touch:` adjacent files or behavior that must stay as they are, whenever a
      plausible over-edit exists.
    - `Verify:` the exact command or check and its expected result (exit code, test name,
      match count), so "done" is observed, not judged.
    - `Source:` the URL and access date for every external fact the item relies on
      (version, API, flag, default). A fact not confirmed in this pass is written
      `(unverified — confirm before executing)`, which makes the item a stop point for
      `/execgoals`, never a silent assumption.
    A `manual` item needs only `Verify:` (the evidence the user provides). One item is one
    coherent change that one `Verify:` can prove: split an item that edits more than three
    files or still contains a choice. Every choice is settled in the plan — a `Decisions`
    subsection stating the option taken and why — or becomes its own `manual` item; an item
    handed to `coder` contains no open decision. Long text that several items reuse goes
    once in a `Canonical texts` subsection, and items reference it by name.

5b. **Open each `GOALS N` section with a stage map.** Group the section's items into stages
    and show them as a table — `Stage | Items | Depends on | Can run in parallel with` — and
    draw step 5's Mermaid flowchart at that same stage level. Two stages are parallel only
    when neither needs the other's result and they edit no file in common; otherwise they
    are sequential. Name each stage after what it delivers, and use the same names when
    explaining the plan to the user. `/execgoals` still runs items in written order; the
    parallel column tells the user which stages can go to separate sessions.

5c. **Write item text in controlled English, modeled on ASD-STE100 Simplified Technical
    English.** The executor follows words literally, so write each item like a
    maintenance procedure:
    - Write one instruction per sentence, as a command: "Replace X with Y.", not "X should
      probably be updated to Y".
    - Keep an instruction to 20 words or fewer and a descriptive sentence to 25 words or
      fewer. A longer sentence usually holds two ideas: split it.
    - Use the active voice. Do not use "-ing" verb forms as instructions.
    - Use one word for one meaning. After you name a thing (a file, a block, a stage), use
      the same name every time; do not use synonyms.
    - Keep the articles ("the", "a"); do not compress sentences into fragments.
    - Write a limit or a warning as a command, before the step it applies to.
    - Do not use vague words: "appropriate", "properly", "as needed", "etc.", "and so on".
    Code, paths, commands, and quoted anchors are exempt: copy them exactly. This rule
    applies to the checklist items; the rationale sections of a plan stay in normal English.

6. **Never overwrite silently.** If `GOALS.md` already exists, read the active root file first
   and merge new findings rather than discarding them. If `dev/goals-archive/README.md` exists,
   read that index too; open an individual archived plan only when historic scope or evidence is
   relevant, so completed detail does not become default planning context. Say plainly what
   changed if this was called directly. `GOALS.md` is meant to be tracked in version control like
   `README.md`, not gitignored: it's project documentation the user keeps, not a regenerable
   artifact.

7. Report: the file path (or, for a standalone `research`-type deliverable, that file's
   path instead), and — when this ran standalone, not backgrounded — the stage map in the
   user's language: each stage in order, what it delivers, and which stages can run at the
   same time. Not the full content (the file has that). Then ask, in the user's language,
   whether the user wants to proceed with `/execgoals` or adjust the plan first.

8. **Never execute.** This command writes `GOALS.md` (or the standalone research deliverable)
   — full stop. It never edits other files, never runs installs/builds/scaffolding, and never
   implements a prior `GOALS.md`'s items, no matter how complete the request already sounds or
   how thoroughly it was already agreed earlier in the conversation. If there's something to
   build, the next step is `/execgoals` (or an explicit separate ask) — never this command, in
   the same turn or any other.

$ARGUMENTS
