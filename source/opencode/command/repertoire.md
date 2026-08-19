---
# base_project:managed
description: Research the target project's domain (scientific, cultural, regulatory, media) before /newgoal plans it — a distinct research pass from /newgoal's own tech-stack research. Standalone, or combined with /newgoal via /newgoal /repertoire in the same message.
---

Research the actual subject matter of the target project — not how to build it (that's
`/newgoal`'s own job), but what it's about: the scientific evidence base, regulatory/legal
context, cultural context, and media/public discourse around it. Produces `REPERTOIRE.md`,
a reference briefing `/newgoal` reads before researching tech/build specifics when the two
are invoked together (`/newgoal /repertoire` in the same message). Also works standalone.

0. **Confirm before running, every time** — same gate `/council` already uses. This is a real
   extra research pass, not free: "Running `/repertoire` spends more tokens researching this
   project's actual subject matter — do you want that?" If the project looks generic/low-stakes
   (an internal tool, a CRUD app with no real-world domain to speak of), say so and suggest
   skipping instead of running anyway.

1. **Gather context without re-asking.** If `/newproject`/`/newgoal` already established what
   this project is in this session, reuse it. If invoked standalone with nothing established,
   ask briefly what the project is about (not the stack — the *subject*: what problem, for whom).

2. **Decide which lenses actually apply** — five reference categories, not all mandatory:
   - **Scientific/evidence base** — is there a body of research (medical, psychological,
     technical) this project's claims or approach should be grounded in?
   - **Regulatory/legal** — does this domain have laws, standards, or compliance regimes that
     shape what's even allowed (health data, financial services, children's privacy, etc.)?
   - **Cultural/social context** — could this project land differently across audiences, carry
     cultural baggage, or touch a sensitive social dynamic?
   - **Media/public discourse** — is there existing public conversation, controversy, or
     narrative about this kind of product that's worth knowing before building into it?
   - **Competitive/market landscape** — who else is in this space, and what do their users
     complain about?

   Judge which apply — don't force all five onto every project. An internal admin dashboard may
   need zero; a mental-health app needs most. **Never treat this five-lens list as a rigid
   per-industry checklist that must always be filled in** — the same mistake as forcing
   `build.md`'s stack-area breakdown onto every goal type, which this project's own
   classification step (`newgoal.md` step 3) already exists to prevent elsewhere.

3. **Show the lens plan and confirm before researching** — list which lenses apply and why, and
   roughly what each will look into. Wait for a go-ahead (or adjustments — the user can drop or
   add a lens) before spending the research budget. This mirrors the planning strategy real
   deep-research agents use when they surface a plan for review before executing it, rather than
   committing silently to a possibly-wrong decomposition.

4. **Research each confirmed lens for real**, evaluating source credibility rather than citing
   the first result:
   - Scientific claims: prefer peer-reviewed/primary sources over blog summaries.
   - Regulatory claims: cite the primary text (the actual law/standard), not a secondary
     description of it.
   - Media claims: deliberately pull from more than one outlet to surface bias rather than
     reproduce a single narrative.
   - Cultural/competitive claims: look for direct evidence (forums, reviews, reporting) over
     assumption.

5. **Write `REPERTOIRE.md`** at the target project's root, one section per researched lens, each
   ending in a "Sources consulted" list — the same convention `GOALS.md` already uses.
   Git-tracked like `GOALS.md`/`README.md`, not gitignored. **Never overwrite silently** — if
   `REPERTOIRE.md` already exists, read it first and merge new findings in, same rule
   `newgoal.md` step 6 applies to `GOALS.md`.

6. **If invoked together with `/newgoal`** (`/newgoal /repertoire` in the same message): finish
   this research first, then let `/newgoal`'s own step 4 read `REPERTOIRE.md` as grounding
   before it researches tech/build specifics — this command's job ends at producing the
   briefing, it doesn't write `GOALS.md` itself.

7. Report only: the file path, and which lenses were actually researched (and which were judged
   not to apply, briefly) — not the full content, the file has that.

$ARGUMENTS
