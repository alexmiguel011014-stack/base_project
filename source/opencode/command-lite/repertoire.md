---
# base_project:managed
description: Research a subject in depth (lite) — a project's domain, or a standalone topic/trend you heard about. States its search limits before running.
---

Research a subject for real. Two cases, same steps: a project's real-world domain (feeds `/newgoal`), or a standalone topic/trend/claim you want investigated on its own. Produces `REPERTOIRE.md`.

This command never implements anything from its own findings, no matter how actionable they look. Writing `REPERTOIRE.md` is the entire job. Acting on a finding is `/newgoal` or a separate explicit ask — never this command.

STEP 1 — Confirm before running, every time. Tell the user plainly what this can search: the live web (articles, docs, preprints, regulatory text, public discussion) — no paid/closed databases like Web of Science or Scopus. Ask: "Running /repertoire spends real tokens researching <the subject> — want that?" If the subject looks generic or low-stakes, say so and suggest skipping.

STEP 2 — Figure out what's being researched. If `/newproject`/`/newgoal` already established a project in this session and the ask is about that project's real-world context, reuse it. If the ask names a topic/trend/claim on its own, independent of building anything right now, that's standalone research — skip to step 3. If unclear, ask briefly what's being researched (the subject, not the stack).

STEP 3 — Decide which of these five lenses apply — not all are mandatory, same five for a project or a standalone topic:
- Scientific/evidence base — is there research backing the claims or practice?
- Regulatory/legal — laws, standards, or compliance regimes that shape what's allowed?
- Cultural/social context — could this land differently across audiences?
- Media/public discourse — existing public conversation or controversy about it?
- Competitive/landscape — who else works in this space, what's the real track record?
Judge which apply — don't force all five onto every subject.

STEP 4 — Show the lens plan and confirm before researching: list which lenses apply and why. Wait for a go-ahead or adjustments.

STEP 5 — Research each confirmed lens for real, judging source credibility:
- Scientific claims: prefer peer-reviewed/primary sources over blog summaries.
- Regulatory claims: cite the primary text, not a secondary description.
- Media claims: pull from more than one outlet.
- Cultural/competitive claims: look for direct evidence over assumption.

STEP 6 — Write `REPERTOIRE.md` at the current project root, one section per researched lens, each ending in a "Sources consulted" list. Git-tracked, not gitignored. Never overwrite silently — if it already exists, read it first and merge new findings in.

STEP 7 — If invoked together with `/newgoal` and this was project-domain research: finish this first, then let `/newgoal` read `REPERTOIRE.md` before it researches tech/build specifics. Standalone topic research has no `/newgoal` follow-on unless asked separately.

STEP 8 — Report: the file path, and which lenses were researched (and which were judged not to apply).

STEP 9 — Never execute. Writing `REPERTOIRE.md` is where this command's job ends — never edit other files, never run installs/builds, never act on a finding even when it looks like an obvious next step.

$ARGUMENTS
