---
# base_project:managed
description: Research and write a single, deeply detailed 0-to-100% build plan for the current project — backend, frontend, connectivity, database, deployment, everything — as GOALS.md.
---

Produce `GOALS.md` at the project root: the closest thing this project has to a master plan,
detailed enough that `/execgoals` can execute against it without re-researching anything — this
command's whole job is to produce the input `/execgoals` consumes. This is a research-heavy, front-loaded command — spend real depth now so nothing has
to be rediscovered later.

**Two ways this runs.** Called directly (`/newgoal`), it is the user's explicit ask — narrate
normally. Dispatched from `/newproject` (see that command's own step 6: whichever
asynchronous/backgrounded subagent mechanism the session exposes, carrying these instructions
as the prompt — or an explicit "no backgrounding available" if it doesn't), it must run as a
real background agent and stay out of the conversation: no progress narration, no intermediate
questions — only a short line when it starts and a short line with the file path when it's
done. The point is depth in the file, not tokens in the chat.

1. **Gather context without re-asking.** If `/newproject` already established the stack, kind
   of project, and starting state in this session, reuse it — do not repeat the questions. If
   invoked standalone with nothing established yet, ask the same brief round `/newproject` step
   1 asks (stack/language, kind of project, greenfield vs. existing) — skip anything already
   obvious from the current directory.

2. **Read `~/.config/opencode/base_project/references/project-standards.md` first** — it's the
   shared definition of what a well-formed project looks like (identity, version control, secrets,
   dependencies, tests, lint/typecheck, CI, basic security, structure) and every plan produced
   here should satisfy it, not reinvent it from scratch.

3. **Classify the goal type before researching or writing anything.** Every plan this command
   writes is one of five types, each with its own defaults, areas, and definition of "done" —
   read `~/.config/opencode/base_project/references/goal-types/<type>.md` in full for whichever
   one fits before doing anything else:

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
    same message — this applies only to the direct, narrated mode above, never to the silent
    background dispatch from `/newproject`, which cannot pause for the confirmation `/council`
    requires): for each item where the choice is genuinely contested rather than a clear
    default (a real fork like monolith vs. microservices or SQL vs. NoSQL, not "which test
    runner" when the stack has one obvious pick), run `/council` on that specific decision —
    including its own confirmation gate — before writing the choice into `GOALS.md`. Record
    the President's verdict as the item, not the full 5-advisor transcript.

4b. **If `/repertoire` was invoked together with this command** (e.g. `/newgoal /repertoire` in
    the same message — same direct-mode-only restriction as 4a): let `/repertoire` finish first
    — it researches the project's actual subject matter (scientific/regulatory/cultural/media),
    not tech choices — and read the `REPERTOIRE.md` it produces before running this step's own
    research. `/repertoire` researches *what the project is about*; this step researches *how to
    build it*; don't let the two blur into one pass or skip reading the briefing once it exists.

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

6. **Never overwrite silently.** If `GOALS.md` already exists, read it first — merge new
   findings in rather than discarding what's there, and say plainly what changed if this was
   called directly. `GOALS.md` is meant to be tracked in version control like `README.md`, not
   gitignored: it's project documentation the user keeps, not a regenerable artifact.

7. Report only: the file path (or, for a standalone `research`-type deliverable, that file's
   path instead), and — when this ran standalone, not backgrounded — a short outline of the
   sections written, not the full content (the file has that).

$ARGUMENTS
