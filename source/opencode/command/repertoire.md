---
# base_project:managed
description: Research a subject in depth — a project's real-world domain (scientific, regulatory, cultural, media context, before /newgoal plans it) or a standalone topic/trend/claim you heard about and want investigated. Real-time web research; states its own limits before running.
---

Research a subject in real depth, evaluating source credibility rather than citing the
first result. Two shapes of the same job:

- **A project's domain** — not how to build it (that's `/newgoal`'s job), but what it's
  about: the scientific evidence base, regulatory/legal context, cultural context, and
  media/public discourse around it. Feeds `/newgoal` when the two run together
  (`/newgoal /repertoire` in the same message).
- **A standalone topic** — a trend, a claim, a practice you heard about (in the media, a
  conversation, anywhere) and want investigated and explained on its own, independent of
  building anything right now.

Both write to `REPERTOIRE.md` at the current project root, same research quality either way.

**This command never implements anything from its own findings** — no matter how actionable
they look, writing `REPERTOIRE.md` is the entire deliverable. Turning a finding into a real
change is `/newgoal` (project-domain mode) or an explicit separate ask (standalone mode),
never this command in the same turn.

0. **Confirm before running, every time** — same gate `/council` already uses, and state
   what this can actually search while asking, so the answer is informed: "Running
   `/repertoire` researches <the subject> for real on the live web — articles,
   documentation, preprints, regulatory text, public discussion, whatever's openly
   indexed. It has no access to paid/closed databases (Web of Science, Scopus, etc.).
   This costs real tokens — want me to run it?" If the subject looks generic/low-stakes
   (an internal tool with no real-world domain, a trend with nothing substantive to
   find), say so and suggest skipping instead of running anyway.

1. **Figure out what's being researched.**
   - If `/newgoal` already established a project in this session and the ask
     is about that project's real-world context, reuse it — don't re-ask.
   - If the ask names a topic, trend, claim, or practice on its own — independent of
     building anything right now — that's standalone topic research; skip straight to
     lens judgment, no project context needed.
   - If genuinely ambiguous, ask briefly what's being researched (not the stack — the
     *subject*).

2. **Decide which lenses actually apply** — five reference categories, not all mandatory,
   the same five whether the subject is a project or a standalone topic:
   - **Scientific/evidence base** — is there a body of research (medical, psychological,
     technical) backing the claims or practice being researched?
   - **Regulatory/legal** — do laws, standards, or compliance regimes shape what's allowed
     or expected here (health data, financial services, children's privacy, etc.)?
   - **Cultural/social context** — could this land differently across audiences or
     communities, carry baggage, or touch a sensitive social dynamic?
   - **Media/public discourse** — is there existing public conversation, controversy, or
     narrative about this worth knowing?
   - **Competitive/landscape** — who else works in this space, what's the real-world track
     record, what do practitioners/users actually say?

   Judge which apply — don't force all five onto every subject. An internal admin
   dashboard may need zero; a mental-health app needs most; a narrow engineering practice
   might only need evidence-base + media/discourse. **Never treat this five-lens list as a
   rigid checklist that must always be filled in** — the same mistake as forcing
   `build.md`'s stack-area breakdown onto every goal type, which this project's own
   classification step (`newgoal.md` step 3) already exists to prevent elsewhere.

3. **Show the lens plan and confirm before researching** — list which lenses apply and why,
   and roughly what each will look into. Wait for a go-ahead (or adjustments — the user can
   drop or add a lens) before spending the research budget. This mirrors the planning
   strategy real deep-research agents use when they surface a plan for review before
   executing it, rather than committing silently to a possibly-wrong decomposition.

4. **Research each confirmed lens for real**, evaluating source credibility rather than
   citing the first result:
   - Scientific claims: prefer peer-reviewed/primary sources over blog summaries.
   - Regulatory claims: cite the primary text (the actual law/standard), not a secondary
     description of it.
   - Media claims: deliberately pull from more than one outlet to surface bias rather than
     reproduce a single narrative.
   - Cultural/competitive claims: look for direct evidence (forums, reviews, reporting)
     over assumption.

5. **Write `REPERTOIRE.md`** at the current project root, one section per researched lens,
   each ending in a "Sources consulted" list — the same convention `GOALS.md` already
   uses. Git-tracked like `GOALS.md`/`README.md`, not gitignored. **Never overwrite
   silently** — if `REPERTOIRE.md` already exists, read it first and merge new findings
   in, same rule `newgoal.md` step 6 applies to `GOALS.md`.

6. **If invoked together with `/newgoal`** (`/newgoal /repertoire` in the same message,
   project-domain mode only): finish this research first, then let `/newgoal`'s own step 4
   read `REPERTOIRE.md` as grounding before it researches tech/build specifics — this
   command's job ends at producing the briefing, it doesn't write `GOALS.md` itself.
   Standalone topic research has no `/newgoal` follow-on unless the user separately asks
   for one.

7. Report only: the file path, and which lenses were actually researched (and which were
   judged not to apply, briefly) — not the full content, the file has that.

8. **Never execute.** Writing `REPERTOIRE.md` is where this command's job ends — it never
   edits other files, never runs installs/builds, and never acts on its own findings, even
   when a finding reads as an obvious next step. Done when the file exists and step 7's
   report is delivered — nothing after that belongs to this command.

$ARGUMENTS
