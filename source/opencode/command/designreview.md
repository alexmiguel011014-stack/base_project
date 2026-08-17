---
# base_project:managed
description: Critique a design — an external mockup/screenshot/URL, or a UI Claude just generated — against a research-backed rubric, then report actionable findings.
---

Run a design review. One engine, two entry points — see `GOALS.md` at the base_project repo
root for the research this command's methodology is built on.

**Two ways this runs.** Explicit, on an external design (the user names or attaches an image,
mockup, or live URL) — narrate normally. Or self-invoked, on Claude's own output: after
producing a non-trivial UI artifact/page (a real page or component, not a one-line copy tweak),
Claude may optionally run this on itself before presenting it. That second path is a judgment
call, not a mandatory gate — small or low-stakes UI changes don't need it, the same restraint
`/council` and `/newgoal`'s step 4a already apply elsewhere in this project. It is never
implemented as a hook: hooks in this repo (`post-edit-format.js`, `usage-log.js`) are
deterministic scripts, not LLM calls, and forcing a full critique pass onto every single UI
generation via hook would add real latency/cost most of the time it isn't warranted.

1. **Identify the input.**
   - Image/mockup: read it directly (native vision) — no tooling needed.
   - Live URL or Claude's own just-produced artifact: use whatever browser/preview automation
     tooling is available in this session to open it, screenshot it at a few widths (desktop/
     tablet/mobile) to catch responsive breakage, and check the console for JS errors that
     affect the experience. Critique the *rendered* result, not the source code — source-only
     review misses overflow, broken responsive layout, and contrast that only shows up once
     painted. If no such tooling is available in this session, say so plainly and fall back to
     reviewing the source/markup directly rather than silently skipping the check.

2. **Run the deterministic pre-check first**, for any text/background color pair and any
   tappable element size visible in the input:
   ```
   node ~/.claude/base_project/scripts/contrast-check.js --fg <hex> --bg <hex> [--large]
   node ~/.claude/base_project/scripts/contrast-check.js --target <widthxheight>
   ```
   These have one objectively correct answer — WCAG contrast ratio, minimum tap-target size —
   so don't spend judgment on them. Report the pass/fail plainly, then move to what actually
   needs a human-grade eye. (Spacing-scale adherence is judged in the local pass below instead
   of coded here — there is no single universal "correct" spacing scale to check against
   without knowing the project's own design tokens.)

3. **Global pass first.** Before nitpicking details, assess the whole: does the layout make
   sense at a glance, is there a clear visual hierarchy, does the first impression match what
   the design is supposed to accomplish? Global-before-local is deliberate — it catches
   structural problems before they get buried under a list of spacing nitpicks.

4. **Local pass second.** Now go detail-level: spacing/alignment consistency, typography (scale,
   line-height, weight contrast), copy clarity, component-level polish. Don't re-litigate
   contrast here — the pre-check already covered it.

5. **Rate along five dimensions**, not just "good/bad": aesthetics, efficiency (how much
   friction to accomplish the task), learnability, usability, and overall — plus whether the
   result matches its stated intent (a landing page and a data-dense dashboard are judged by
   different standards).

6. **Report using the same shape as `/code-review`'s findings**: most-severe first, each finding
   as a one-sentence summary plus a concrete "what breaks and for whom" — never a vague "could
   be better." A finding without an actionable next step doesn't belong in the report; either
   name the fix or don't list it.

7. **Reserve the full pipeline for designs that warrant it.** A one-line copy tweak or a tiny
   icon swap doesn't need the whole sequence above — say so and give a direct answer instead.

$ARGUMENTS
