---
# base_project:managed
description: Critique a design against a research-backed rubric (lite), then report actionable findings.
---

Run a design review on an external design (a mockup, screenshot, or URL the user names) or on a UI just produced in this session.

STEP 1 — Identify the input.
- Image or mockup → read it directly, no tooling needed.
- Live URL or a UI just produced → use available browser/preview tooling to open it, screenshot it at a few widths (desktop/tablet/mobile), and check the console for JS errors. Critique the rendered result, not just the source — overflow, broken responsive layout, and contrast issues only show up once painted. If no such tooling is available, say so and review the source/markup directly instead.

STEP 2 — Run the deterministic pre-check for any text/background color pair and any tappable element size visible in the input:
```
node ~/.config/opencode/base_project/scripts/contrast-check.js --fg <hex> --bg <hex> [--large]
node ~/.config/opencode/base_project/scripts/contrast-check.js --target <widthxheight>
```
Report pass/fail plainly, then move to what needs a human-grade eye.

STEP 3 — Calibrate against named exemplars before judging. Name 1-2 real production design systems most relevant to what's being reviewed: Stripe, Linear, or Vercel for most cases, Notion for docs/content-heavy screens. Hold the review against that comparison explicitly. If browser tooling is available, optionally look at a matching reference gallery (Mobbin for shipped product UX, Awwwards/Godly for visual craft, Land-book for landing pages) — optional deepening, not a requirement.

STEP 4 — Global pass first: does the layout make sense at a glance, is there a clear visual hierarchy, does the first impression match the design's purpose? Catch structural problems before detail-level nitpicks.

STEP 5 — Local pass second: spacing/alignment consistency, typography (scale, line-height, weight contrast), copy clarity, component-level polish. Don't re-check contrast — step 2 covered it.

STEP 6 — Rate along five dimensions: aesthetics, efficiency, learnability, usability, and overall — plus whether the result matches its stated intent.

STEP 7 — Report findings most-severe first. Each finding: one-sentence summary plus a concrete "what breaks and for whom." Skip any finding with no actionable fix. If the findings are big enough that the user will want to rebuild the design, mention once that `/plugins` catalogs design-generation tools for that — this command critiques, it doesn't generate.

STEP 8 — A one-line copy tweak or a tiny icon swap doesn't need this whole sequence — say so and answer directly instead.

$ARGUMENTS
