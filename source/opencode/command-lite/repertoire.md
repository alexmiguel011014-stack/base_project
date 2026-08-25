---
# base_project:managed
description: Research the target project's real-world subject matter before /newgoal plans it (lite). Standalone, or combined via /newgoal /repertoire.
---

Research what the project is actually about — the scientific evidence base, regulatory/legal context, cultural context, and media/public discourse around it. Not how to build it, that's `/newgoal`'s job. Produces `REPERTOIRE.md`.

STEP 1 — Confirm before running, every time: "Running /repertoire spends more tokens researching this project's real-world subject matter — do you want that?" If the project looks generic or low-stakes, say so and suggest skipping instead.

STEP 2 — Gather context without re-asking. If `/newproject`/`/newgoal` already established what the project is in this session, reuse it. Otherwise ask briefly what the project is about — the subject, not the stack.

STEP 3 — Decide which of these five lenses actually apply — not all are mandatory:
- Scientific/evidence base — is there research this project's claims should be grounded in?
- Regulatory/legal — laws, standards, or compliance regimes that shape what's allowed?
- Cultural/social context — could this land differently across audiences?
- Media/public discourse — existing public conversation or controversy about this kind of product?
- Competitive/market landscape — who else is in this space, what do their users complain about?
Judge which apply — don't force all five onto every project.

STEP 4 — Show the lens plan and confirm before researching: list which lenses apply and why, roughly what each will look into. Wait for a go-ahead or adjustments.

STEP 5 — Research each confirmed lens for real, judging source credibility:
- Scientific claims: prefer peer-reviewed/primary sources over blog summaries.
- Regulatory claims: cite the primary text, not a secondary description.
- Media claims: pull from more than one outlet.
- Cultural/competitive claims: look for direct evidence over assumption.

STEP 6 — Write `REPERTOIRE.md` at the project root, one section per researched lens, each ending in a "Sources consulted" list. Git-tracked, not gitignored. Never overwrite silently — if it already exists, read it first and merge new findings in.

STEP 7 — If invoked together with `/newgoal`, finish this research first, then let `/newgoal` read `REPERTOIRE.md` before it researches tech/build specifics. This command's job ends at the briefing.

STEP 8 — Report: the file path, and which lenses were researched (and which were judged not to apply).

$ARGUMENTS
