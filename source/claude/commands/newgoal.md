---
# base_project:managed
description: Research and write a single, deeply detailed 0-to-100% build plan for the current project — backend, frontend, connectivity, database, deployment, everything — as GOALS.md.
---

Produce `GOALS.md` at the project root: the closest thing this project has to a master plan,
detailed enough that a future `/buildproject` command (not built yet — this command's whole
job is to produce the input it will consume) could execute against it without re-researching
anything. This is a research-heavy, front-loaded command — spend real depth now so nothing has
to be rediscovered later.

**Two ways this runs.** Called directly (`/newgoal`), it is the user's explicit ask — narrate
normally. Dispatched from `/newproject` (see that command's own instructions), it must run as
a background task and stay out of the conversation: no progress narration, no intermediate
questions — only a short line when it starts and a short line with the file path when it's
done. The point is depth in the file, not tokens in the chat.

1. **Gather context without re-asking.** If `/newproject` already established the stack, kind
   of project, and starting state in this session, reuse it — do not repeat the questions. If
   invoked standalone with nothing established yet, ask the same brief round `/newproject` step
   1 asks (stack/language, kind of project, greenfield vs. existing) — skip anything already
   obvious from the current directory.

2. **Read `~/.claude/base_project/references/project-standards.md` first** — it's the shared
   definition of what a well-formed project looks like (identity, version control, secrets,
   dependencies, tests, lint/typecheck, CI, basic security, structure) and every plan produced
   here should satisfy it, not reinvent it from scratch.

3. **Research for real, in one pass, as deep as the project needs** — this is a single
   front-loaded research effort, not an open-ended crawl to repeat every session. Use web
   search for current best practices and concrete tool/library choices where the stack is
   non-trivial (a script or CLI tool needs far less of this than a full-stack app with a
   database and auth) — a vague plan the user has to fill in themselves defeats the point of
   this command.

4. **Cover every area that applies to this project's kind** — skip what genuinely doesn't
   apply (a CLI tool has no frontend section) rather than padding with boilerplate:
   - **Backend**: language/framework choice and why, service structure, API design/style.
   - **Frontend**: framework choice and why, state management, component/page structure.
   - **Connectivity**: how frontend/backend/external services talk to each other — REST/GraphQL/
     RPC, third-party APIs the project will depend on, webhooks, real-time needs.
   - **Database**: engine choice and why, schema shape at a high level, migration strategy.
   - **Auth**: approach (session/token/OAuth/third-party), where it lives in the stack.
   - **Deployment/infra**: where this runs, how it ships, environment/config strategy.
   - **Testing**: what layers need coverage and with what tooling, given the stack chosen.
   - **Security**: the basics from `project-standards.md` §8, plus anything stack-specific.

4a. **If `/council` was invoked together with this command** (e.g. `/newgoal /council` in the
    same message — this applies only to the direct, narrated mode above, never to the silent
    background dispatch from `/newproject`, which cannot pause for the confirmation `/council`
    requires): for each area in step 4 where the choice is genuinely contested rather than a
    clear default (a real fork like monolith vs. microservices or SQL vs. NoSQL, not "which
    test runner" when the stack has one obvious pick), run `/council` on that specific decision
    — including its own confirmation gate — before writing the choice into `GOALS.md`. Record
    the President's verdict as the item, not the full 5-advisor transcript.

5. **Write `GOALS.md` in English**, regardless of the conversation's language — this file is
   meant to be read by future tooling (`/buildproject`) as much as by the user, and the user
   asked for it explicitly. Structure it as concrete, checkable items grouped by the areas
   above, not prose paragraphs — each item should be something a future execution pass can
   look at and know whether it's done. Order the items: what has to exist before what.

6. **Never overwrite silently.** If `GOALS.md` already exists, read it first — merge new
   findings in rather than discarding what's there, and say plainly what changed if this was
   called directly. `GOALS.md` is meant to be tracked in version control like `README.md`, not
   gitignored: it's project documentation the user keeps, not a regenerable artifact.

7. Report only: the file path, and — when this ran standalone, not backgrounded — a short
   outline of the sections written, not the full content (the file has that).

$ARGUMENTS
