---
# base_project:managed
name: designreview
description: Review a screenshot, mockup, URL, or newly built interface against a research-backed design and accessibility rubric. Use for $designreview or an explicit visual/UX critique.
---

Critique the actual rendered design, not only source code.

1. Resolve the artifact: attached image, local screenshot, design file, or live URL. If the interface can run locally, use the browser/preview capability and inspect representative viewport sizes.
2. Establish the intended audience, task, and constraints from existing context. Ask only for missing information that would materially change the review.
3. Evaluate visual hierarchy, typography, spacing, alignment, color/contrast, responsive behavior, states and feedback, accessibility, content clarity, consistency, and implementation feasibility.
4. Use `node ~/.claude/base_project/scripts/contrast-check.js --fg <hex> --bg <hex> [--large]` and `--target <widthxheight>` when objective color or target-size checks apply. The helper path remains shared so existing installations and diaries are not split.
5. Distinguish direct observations from inferred issues. Attach findings to exact components, screen regions, or source locations.
6. Prioritize findings by user impact and implementation effort. Give concrete suggested values or patterns instead of vague “improve spacing” advice.
7. Do not edit the UI unless the user explicitly asks for implementation. For a review-only request, return strengths, prioritized issues, and an actionable fix list.

