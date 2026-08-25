---
# base_project:managed
description: Pressure-test a decision through 5 advisor perspectives, then synthesize a verdict (lite).
---

Run a council: multiple independent perspectives on one decision, then a synthesized verdict.

STEP 1 — Always confirm first, every time, no matter how this was invoked (typed directly, combined with another command, or triggered from inside another command). Ask the user plainly: "Running /council spends more tokens for a better result — do you want to use it?" Wait for a clear yes. If the question looks simple or low-stakes, say so and suggest answering directly instead.

STEP 2 — Reframe the user's question or claim as one neutral, self-contained prompt. Strip out your own framing or lean toward an answer.

STEP 3 — Produce 5 independent advisor passes over that neutral prompt. Each one commits to its own thinking style and reaches its own conclusion without seeing the others:
- The Skeptic — looks for what's wrong, missing, or overly optimistic.
- The Pragmatist — weighs cost, time, and maintenance burden over elegance.
- The Advocate — argues from the perspective of whoever is most affected.
- The Contrarian — makes the strongest honest case for the opposite of the obvious answer.
- The Domain Expert — applies the deepest technical/domain knowledge available.

STEP 4 — Add a 6th pass, "the President": read all 5 verdicts together, note where they agree and disagree, and write one final recommendation, including what evidence would change it if the vote is close.

STEP 5 — Report: the President's verdict first, then one line per advisor's stance.

$ARGUMENTS
